//! Alerts background job for the SIH26016 land-acquisition platform.
//!
//! Implements the most important subset of the 9-class alert taxonomy
//! described in Master PDF §39:
//!   - `statutory_deadline_breached`        (severity = critical)
//!   - `statutory_deadline_approaching`     (severity = low / medium / high)
//!
//! The job scans non-terminal `workflow_instance` rows, computes how many
//! days remain until `deadline_at`, and inserts an `alert` row when
//! appropriate. Insertions are idempotent within a 24-hour window so that
//! repeated scans do not produce duplicate alerts.

use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;

/// Default scan cadence for [`run_alerts_loop`]: 5 minutes.
pub const DEFAULT_SCAN_INTERVAL: std::time::Duration = std::time::Duration::from_secs(5 * 60);

/// Default tenant used when no per-row tenant context is available.
/// Matches the sentinel used by `services/api` (`Uuid::from_u128(1)` ==
/// `00000000-0000-0000-0000-000000000001`).
const DEFAULT_TENANT_ID: Uuid = Uuid::from_u128(1);

/// Classifies the number of days remaining until a statutory deadline into an
/// `(severity, alert_type)` pair, or returns `None` when no alert is needed.
///
/// Decision table (per Master PDF §39):
///   - `days <= 0`       -> `("critical", "statutory_deadline_breached")`
///   - `1..=7`           -> `("high",   "statutory_deadline_approaching")`
///   - `8..=30`          -> `("medium", "statutory_deadline_approaching")`
///   - `31..=90`         -> `("low",    "statutory_deadline_approaching")`
///   - `> 90`            -> `None` (too far out to alert)
///
/// This is a pure helper so the decision logic can be unit-tested without a
/// database.
pub fn classify_deadline(days_remaining: i64) -> Option<(&'static str, &'static str)> {
    if days_remaining <= 0 {
        Some(("critical", "statutory_deadline_breached"))
    } else if days_remaining <= 7 {
        Some(("high", "statutory_deadline_approaching"))
    } else if days_remaining <= 30 {
        Some(("medium", "statutory_deadline_approaching"))
    } else if days_remaining <= 90 {
        Some(("low", "statutory_deadline_approaching"))
    } else {
        None
    }
}

/// Builds the human-readable message for an alert given its classification
/// and the number of days remaining (negative when overdue).
fn alert_message(alert_type: &str, days_remaining: i64) -> String {
    if alert_type == "statutory_deadline_breached" {
        // days_remaining is <= 0 here; show the overdue magnitude as positive.
        format!(
            "Workflow deadline breached: {} days overdue",
            -days_remaining
        )
    } else {
        format!("Statutory deadline in {} days", days_remaining)
    }
}

/// Runs a single alerts scan and returns the number of alerts inserted.
///
/// The scan is idempotent: for each `(project_id, alert_type, severity)`
/// triple, at most one alert is inserted per 24-hour window.
pub async fn run_alerts_once(pool: PgPool) -> Result<u64, sqlx::Error> {
    let now = Utc::now();

    // Only consider workflows that are still live and have a statutory
    // deadline attached. Completed/lapsed instances are ignored.
    let rows = sqlx::query(
        "SELECT id, project_id, deadline_at \
         FROM workflow_instance \
         WHERE completed_at IS NULL \
           AND lapsed_at IS NULL \
           AND deadline_at IS NOT NULL",
    )
    .fetch_all(&pool)
    .await?;

    let mut inserted: u64 = 0;

    for row in rows {
        let project_id: Uuid = match row.try_get("project_id") {
            Ok(v) => v,
            Err(e) => {
                eprintln!(
                    "[alerts] skipping workflow_instance row: cannot read project_id: {e}"
                );
                continue;
            }
        };

        let deadline_at: Option<DateTime<Utc>> = match row.try_get("deadline_at") {
            Ok(v) => v,
            Err(e) => {
                eprintln!(
                    "[alerts] skipping workflow_instance for project {project_id}: cannot read deadline_at: {e}"
                );
                continue;
            }
        };
        let Some(deadline) = deadline_at else {
            continue;
        };

        // chrono::Duration::num_days truncates toward zero; for a deadline
        // in the future this is the number of full days remaining, and for
        // a deadline in the past it is the (negative) number of full days
        // overdue.
        let days_remaining = (deadline - now).num_days();

        let Some((severity, alert_type)) = classify_deadline(days_remaining) else {
            continue;
        };

        // Idempotency: skip when an alert of the same (project, type,
        // severity) was already created within the last 24 hours. This
        // allows the severity to escalate (low -> medium -> high ->
        // critical) over time without being blocked by an earlier,
        // lower-severity approaching alert.
        let already = sqlx::query(
            "SELECT 1 FROM alert \
             WHERE project_id = $1 \
               AND alert_type = $2 \
               AND severity = $3 \
               AND created_at > now() - interval '24 hours' \
             LIMIT 1",
        )
        .bind(project_id)
        .bind(alert_type)
        .bind(severity)
        .fetch_optional(&pool)
        .await;

        match already {
            Ok(Some(_)) => continue,
            Ok(None) => {}
            Err(e) => {
                eprintln!(
                    "[alerts] idempotency check failed for project {project_id} ({alert_type}/{severity}): {e}"
                );
                // Don't insert blindly on error; wait for the next scan.
                continue;
            }
        }

        let message = alert_message(alert_type, days_remaining);

        let result = sqlx::query(
            "INSERT INTO alert \
                (tenant_id, project_id, parcel_id, severity, alert_type, message, due_at, created_at) \
             VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)",
        )
        .bind(DEFAULT_TENANT_ID)
        .bind(project_id)
        .bind(severity)
        .bind(alert_type)
        .bind(&message)
        .bind(deadline)
        .bind(now)
        .execute(&pool)
        .await;

        match result {
            Ok(_) => {
                inserted += 1;
                eprintln!(
                    "[alerts] inserted {alert_type}/{severity} for project {project_id} ({message})"
                );
            }
            Err(e) => {
                eprintln!(
                    "[alerts] failed to insert {alert_type}/{severity} alert for project {project_id}: {e}"
                );
            }
        }
    }

    Ok(inserted)
}

/// Runs the alerts scan loop forever (until the future is dropped/cancelled),
/// waiting `interval` between scans. The first scan runs immediately on
/// startup, then subsequent scans run every `interval`.
///
/// Use [`DEFAULT_SCAN_INTERVAL`] (5 minutes) unless you have a reason to
/// tune otherwise.
///
/// Cancellation: the loop awaits each tick inside a `tokio::select!`, so
/// dropping the future (e.g. via a `tokio::select!` with a shutdown signal
/// at the call site) cancels the pending tick cleanly.
pub async fn run_alerts_loop(pool: PgPool, interval: std::time::Duration) {
    let mut ticker = tokio::time::interval(interval);
    // tokio::time::interval fires its first tick immediately, so the initial
    // scan runs without waiting a full interval.
    loop {
        tokio::select! {
            _ = ticker.tick() => {}
            // Cancellation point: dropping this future aborts the wait.
        }

        match run_alerts_once(pool.clone()).await {
            Ok(count) if count > 0 => {
                eprintln!("[alerts] scan complete: inserted {count} alert(s)");
            }
            Ok(_) => {
                // Quiet cycle; nothing to insert. Avoid log spam.
            }
            Err(e) => {
                eprintln!("[alerts] scan failed: {e}");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- Breached (critical) ----------------------------------------------

    #[test]
    fn classify_breach_at_zero_days() {
        assert_eq!(
            classify_deadline(0),
            Some(("critical", "statutory_deadline_breached"))
        );
    }

    #[test]
    fn classify_breach_negative_days() {
        assert_eq!(
            classify_deadline(-1),
            Some(("critical", "statutory_deadline_breached"))
        );
        assert_eq!(
            classify_deadline(-90),
            Some(("critical", "statutory_deadline_breached"))
        );
    }

    // --- Approaching: high (1..=7) ----------------------------------------

    #[test]
    fn classify_high_at_one_day() {
        assert_eq!(
            classify_deadline(1),
            Some(("high", "statutory_deadline_approaching"))
        );
    }

    #[test]
    fn classify_high_at_seven_days() {
        assert_eq!(
            classify_deadline(7),
            Some(("high", "statutory_deadline_approaching"))
        );
    }

    // --- Approaching: medium (8..=30) -------------------------------------

    #[test]
    fn classify_medium_at_eight_days() {
        assert_eq!(
            classify_deadline(8),
            Some(("medium", "statutory_deadline_approaching"))
        );
    }

    #[test]
    fn classify_medium_at_thirty_days() {
        assert_eq!(
            classify_deadline(30),
            Some(("medium", "statutory_deadline_approaching"))
        );
    }

    // --- Approaching: low (31..=90) --------------------------------------

    #[test]
    fn classify_low_at_thirty_one_days() {
        assert_eq!(
            classify_deadline(31),
            Some(("low", "statutory_deadline_approaching"))
        );
    }

    #[test]
    fn classify_low_at_ninety_days() {
        assert_eq!(
            classify_deadline(90),
            Some(("low", "statutory_deadline_approaching"))
        );
    }

    // --- No alert ---------------------------------------------------------

    #[test]
    fn classify_none_above_ninety_days() {
        assert_eq!(classify_deadline(91), None);
        assert_eq!(classify_deadline(180), None);
        assert_eq!(classify_deadline(365), None);
    }

    // --- Message formatting -----------------------------------------------

    #[test]
    fn message_breach_shows_overdue_magnitude() {
        // days_remaining = -3 -> "3 days overdue"
        assert_eq!(
            alert_message("statutory_deadline_breached", -3),
            "Workflow deadline breached: 3 days overdue"
        );
    }

    #[test]
    fn message_breach_at_zero_days() {
        assert_eq!(
            alert_message("statutory_deadline_breached", 0),
            "Workflow deadline breached: 0 days overdue"
        );
    }

    #[test]
    fn message_approaching_shows_days_remaining() {
        assert_eq!(
            alert_message("statutory_deadline_approaching", 5),
            "Statutory deadline in 5 days"
        );
    }
}
