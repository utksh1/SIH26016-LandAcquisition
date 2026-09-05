//! Timeline engine for the SIH26016 workflow crate.
//!
//! Implements the statutory deadline and lapse rules described in the Master
//! PDF (§22.3, §22.4, §22.6 and §36). The module is intentionally pure — none
//! of the functions mutate their inputs; callers are responsible for
//! persisting any state transitions they decide to apply.
//!
//! Sections implemented:
//! - §22.2 60-day (LARR) / 21-day (NH Act) objection window
//! - §22.3 Section 19 declaration within 12 months of the Section 11
//!   notification
//! - §22.4 Award within 12 months of the Section 19 declaration
//! - §22.6 Section 38 80%-compensation-possession gate
//! - §36   Court-stay day exclusion (extends statutory deadlines) and
//!         deadline severity buckets

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sih_domain::{Authority, Project, ProjectStage};

/// Compute the number of whole days between two UTC timestamps.
///
/// Returns `end - start` in days. Negative when `end` is before `start`.
pub fn days_between(start: DateTime<Utc>, end: DateTime<Utc>) -> i64 {
    (end - start).num_days()
}

/// Returns true if the statutory objection window is still open at `now`.
///
/// Implements Master PDF §22.2. Under the RFCTLARR Act 2013 (Section 15) the
/// objection window is 60 days from the Section 11 notification; under the
/// National Highways Act 1956 (Section 3A/3B) the window is 21 days. The
/// boundary day is treated as the last day the window is open.
pub fn objection_window_open(
    notification_at: DateTime<Utc>,
    authority: Authority,
    now: DateTime<Utc>,
) -> bool {
    let window_days: i64 = match authority {
        Authority::Larr => 60,
        Authority::NationalHighways => 21,
    };
    now <= notification_at + Duration::days(window_days)
}

/// Returns true if `now` is within 12 months of the Section 11 notification.
///
/// Implements Master PDF §22.3: the Section 19 declaration must be issued
/// within 12 months of the Section 11 notification, otherwise the
/// notification lapses. Uses 365 days as the MVP approximation of "12
/// months" (matching the convention already used by `lapse_if_due` in
/// `lib.rs`).
pub fn declaration_within_12_months(notification_at: DateTime<Utc>, now: DateTime<Utc>) -> bool {
    now <= notification_at + Duration::days(365)
}

/// Returns true if `now` is within 12 months of the Section 19 declaration.
///
/// Implements Master PDF §22.4: the award must be made within 12 months of
/// the Section 19 declaration.
pub fn award_within_12_months_of_declaration(
    declaration_at: DateTime<Utc>,
    now: DateTime<Utc>,
) -> bool {
    now <= declaration_at + Duration::days(365)
}

/// Returns true if at least 80% of the awarded compensation has been paid.
///
/// Implements Master PDF §22.6 (Section 38 of the RFCTLARR Act 2013):
/// possession cannot be taken until compensation and R&R entitlements are
/// paid (or tendered). The MVP uses an 80% threshold so that small rounding
/// shortfalls do not hard-block possession.
///
/// Returns `true` when nothing has been awarded (`awarded <= 0`), since no
/// compensation is owed.
pub fn possession_payment_eligible(
    compensation_paid_total_paise: i64,
    compensation_awarded_total_paise: i64,
) -> bool {
    if compensation_awarded_total_paise <= 0 {
        return true;
    }
    if compensation_paid_total_paise <= 0 {
        return false;
    }
    // paid * 5 >= awarded * 4  <=>  paid >= awarded * 4 / 5  <=>  paid >= 80%
    // Using cross-multiplication to avoid floating point.
    compensation_paid_total_paise * 5 >= compensation_awarded_total_paise * 4
}

/// Compute the effective number of days between `start` and `end`, excluding
/// any days that fall within a court-stay period.
///
/// Implements Master PDF §36: court-stay periods extend the statutory
/// deadline by the stay duration, so they must be excluded when computing
/// elapsed time. Each entry in `stays` is a `(stay_from, stay_to)` tuple
/// representing the stay period as stored on the `litigation_case` table
/// (columns `stay_from` and `stay_to`).
///
/// Iterates over each day in `[start, end)` using `Duration::days(1)` steps
/// and counts only those days whose `[day_start, day_end)` bucket does not
/// overlap any stay period. Returns 0 when `end <= start`.
pub fn exclude_court_stay_days(
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    stays: &[(DateTime<Utc>, DateTime<Utc>)],
) -> i64 {
    if end <= start {
        return 0;
    }
    let mut elapsed: i64 = 0;
    let mut cursor = start;
    while cursor < end {
        let day_start = cursor;
        let day_end = cursor + Duration::days(1);
        let in_stay = stays.iter().any(|(from, to)| {
            // Half-open [day_start, day_end) overlaps with the stay iff
            // day_start < to AND from < day_end.
            day_start < *to && *from < day_end
        });
        if !in_stay {
            elapsed += 1;
        }
        cursor = day_end;
    }
    elapsed
}

/// Snapshot of a deadline's status relative to "now".
///
/// Returned by [`check_deadline`]. Used by the alerts job and the timeline
/// dashboard to render severity badges and trigger escalations.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct DeadlineCheck {
    /// Whole days until the deadline. Negative when the deadline is breached.
    pub days_remaining: i64,
    /// True if `now > deadline_at`.
    pub is_breached: bool,
    /// True if `0 <= days_remaining <= 90` (deadline is on the horizon but
    /// not yet breached).
    pub is_approaching: bool,
    /// Severity bucket: `"critical"`, `"high"`, `"medium"`, `"low"` or `""`
    /// (empty string when more than 90 days remain).
    pub severity: &'static str,
}

/// Classify a deadline relative to `now`.
///
/// Implements Master PDF §36 severity buckets:
/// - `critical` — breached (`now > deadline_at`)
/// - `high`     — 1 to 7 days remaining (inclusive)
/// - `medium`   — 8 to 30 days remaining (inclusive)
/// - `low`      — 31 to 90 days remaining (inclusive)
/// - `""`       — more than 90 days remaining
pub fn check_deadline(deadline_at: DateTime<Utc>, now: DateTime<Utc>) -> DeadlineCheck {
    let days_remaining = (deadline_at - now).num_days();
    let is_breached = now > deadline_at;
    let is_approaching = !is_breached && days_remaining <= 90;
    let severity: &'static str = if is_breached {
        "critical"
    } else if days_remaining <= 7 {
        "high"
    } else if days_remaining <= 30 {
        "medium"
    } else if days_remaining <= 90 {
        "low"
    } else {
        ""
    };
    DeadlineCheck {
        days_remaining,
        is_breached,
        is_approaching,
        severity,
    }
}

/// Pure-function lapse decision for a project.
///
/// Implements Master PDF §22.3, §22.4 and §36 lapse rules. Returns
/// `Some(ProjectStage::Lapsed)` when the project should lapse based on its
/// current stage and timestamps, otherwise `None`. This function does not
/// mutate `project` — the caller is responsible for applying the transition.
///
/// Cases covered:
/// - LARR + PreliminaryNotification + `now > notification_at + 12 months`
///   → Lapsed
/// - NH Act + PreliminaryNotification + `now > notification_at + 12 months`
///   → Lapsed
/// - LARR + Declaration + `now > updated_at + 12 months` (no award yet)
///   → Lapsed
///
/// Note: `Project` does not yet expose a dedicated `declaration_at` field;
/// `updated_at` is used as a proxy for when the declaration was issued, on
/// the assumption that the stage transition into `Declaration` was the most
/// recent mutation. This mirrors the convention used by `lapse_if_due` in
/// `lib.rs` (which is intentionally NOT called here — this function is a
/// pure re-implementation).
pub fn lapse_stage_if_overdue(project: &Project, now: DateTime<Utc>) -> Option<ProjectStage> {
    match (project.authority, project.stage) {
        (Authority::Larr, ProjectStage::PreliminaryNotification)
        | (Authority::NationalHighways, ProjectStage::PreliminaryNotification) => {
            project.preliminary_notification_at.and_then(|notification_at| {
                if now > notification_at + Duration::days(365) {
                    Some(ProjectStage::Lapsed)
                } else {
                    None
                }
            })
        }
        (Authority::Larr, ProjectStage::Declaration) => {
            if now > project.updated_at + Duration::days(365) {
                Some(ProjectStage::Lapsed)
            } else {
                None
            }
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use sih_domain::Parcel;
    use uuid::Uuid;

    fn utc(year: i32, month: u32, day: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(year, month, day, 0, 0, 0).unwrap()
    }

    fn make_project(
        authority: Authority,
        stage: ProjectStage,
        notification_at: Option<DateTime<Utc>>,
        updated_at: DateTime<Utc>,
    ) -> Project {
        Project {
            id: Uuid::new_v4(),
            name: "Timeline Engine Test Project".to_string(),
            authority,
            state_code: "RJ".to_string(),
            district_code: "BHP".to_string(),
            stage,
            parcels: vec![Parcel {
                id: Uuid::new_v4(),
                survey_number: "1042/1".to_string(),
                owner_name: "Rameshwar Patel".to_string(),
                area_hectares: 1.25,
                district_code: "BHP".to_string(),
            }],
            preliminary_notification_at: notification_at,
            updated_at,
        }
    }

    #[test]
    fn days_between_simple() {
        assert_eq!(days_between(utc(2024, 1, 1), utc(2024, 1, 11)), 10);
        // Negative when end is before start.
        assert_eq!(days_between(utc(2024, 1, 11), utc(2024, 1, 1)), -10);
        // Same day -> 0.
        assert_eq!(days_between(utc(2024, 1, 1), utc(2024, 1, 1)), 0);
    }

    #[test]
    fn objection_window_open_larr_60_days() {
        let notif = utc(2024, 1, 1);
        // Day 30 (Jan 31) — still open.
        assert!(objection_window_open(notif, Authority::Larr, utc(2024, 1, 31)));
        // Day 60 (Mar 1) — last day the window is open.
        assert!(objection_window_open(notif, Authority::Larr, utc(2024, 3, 1)));
        // Day 61 (Mar 2) — closed.
        assert!(!objection_window_open(
            notif,
            Authority::Larr,
            utc(2024, 3, 2)
        ));
    }

    #[test]
    fn objection_window_open_nh_21_days() {
        let notif = utc(2024, 1, 1);
        // Day 10 (Jan 11) — still open.
        assert!(objection_window_open(
            notif,
            Authority::NationalHighways,
            utc(2024, 1, 11)
        ));
        // Day 21 (Jan 22) — last day the window is open.
        assert!(objection_window_open(
            notif,
            Authority::NationalHighways,
            utc(2024, 1, 22)
        ));
        // Day 22 (Jan 23) — closed.
        assert!(!objection_window_open(
            notif,
            Authority::NationalHighways,
            utc(2024, 1, 23)
        ));
    }

    #[test]
    fn declaration_within_12_months_boundary() {
        let notif = utc(2024, 1, 1);
        // Month 11 (Dec 1, 2024) — within 12 months.
        assert!(declaration_within_12_months(notif, utc(2024, 12, 1)));
        // Exactly 365 days later (Dec 31, 2024 — 2024 is a leap year) — still ok.
        assert!(declaration_within_12_months(notif, utc(2024, 12, 31)));
        // Month 13 (Feb 1, 2025) — past 12 months.
        assert!(!declaration_within_12_months(notif, utc(2025, 2, 1)));
    }

    #[test]
    fn award_within_12_months_of_declaration_boundary() {
        let decl = utc(2024, 1, 1);
        assert!(award_within_12_months_of_declaration(decl, utc(2024, 12, 1)));
        assert!(!award_within_12_months_of_declaration(decl, utc(2025, 2, 1)));
    }

    #[test]
    fn possession_payment_eligible_80_percent_threshold() {
        // Awarded 100000 paise -> need at least 80000 paid.
        assert!(!possession_payment_eligible(79_999, 100_000));
        assert!(possession_payment_eligible(80_000, 100_000));
        assert!(possession_payment_eligible(90_000, 100_000));
        assert!(possession_payment_eligible(100_000, 100_000));
        // Nothing awarded -> eligible (no compensation owed).
        assert!(possession_payment_eligible(0, 0));
        // Negative/zero awarded treated as eligible.
        assert!(possession_payment_eligible(0, -1));
        // Positive awarded, nothing paid -> not eligible.
        assert!(!possession_payment_eligible(0, 100_000));
    }

    #[test]
    fn exclude_court_stay_days_no_stays_returns_total() {
        let start = utc(2024, 1, 1);
        let end = utc(2024, 2, 1); // 31 days in January.
        assert_eq!(exclude_court_stay_days(start, end, &[]), 31);
    }

    #[test]
    fn exclude_court_stay_days_subtracts_stay_period() {
        let start = utc(2024, 1, 1);
        let end = utc(2024, 2, 1); // 31 days.
        // 10-day stay in the middle: Jan 10..Jan 20 (exclusive of stay_to)
        // excludes days Jan 10, 11, ..., Jan 19 (10 days). Effective = 21.
        let stays = vec![(utc(2024, 1, 10), utc(2024, 1, 20))];
        assert_eq!(exclude_court_stay_days(start, end, &stays), 21);
    }

    #[test]
    fn exclude_court_stay_days_stay_extending_past_end() {
        let start = utc(2024, 1, 1);
        let end = utc(2024, 2, 1); // 31 days.
        // Stay that starts before `end` and extends past it: only Jan 1..Jan 9
        // are counted (9 days), Jan 10 onwards is excluded.
        let stays = vec![(utc(2024, 1, 10), utc(2024, 3, 1))];
        assert_eq!(exclude_court_stay_days(start, end, &stays), 9);
    }

    #[test]
    fn exclude_court_stay_days_multiple_overlapping_stays() {
        let start = utc(2024, 1, 1);
        let end = utc(2024, 1, 31); // 30 days.
        // Two overlapping stays that together cover Jan 5..Jan 15 (10 days).
        let stays = vec![
            (utc(2024, 1, 5), utc(2024, 1, 12)),
            (utc(2024, 1, 10), utc(2024, 1, 15)),
        ];
        // Effective = 30 - 10 = 20.
        assert_eq!(exclude_court_stay_days(start, end, &stays), 20);
    }

    #[test]
    fn exclude_court_stay_days_end_before_start_returns_zero() {
        assert_eq!(
            exclude_court_stay_days(utc(2024, 2, 1), utc(2024, 1, 1), &[]),
            0
        );
    }

    #[test]
    fn check_deadline_far_future_is_empty_severity() {
        let now = utc(2024, 1, 1);
        let check = check_deadline(now + Duration::days(100), now);
        assert_eq!(check.days_remaining, 100);
        assert!(!check.is_breached);
        assert!(!check.is_approaching);
        assert_eq!(check.severity, "");
    }

    #[test]
    fn check_deadline_low_bucket_31_to_90_days() {
        let now = utc(2024, 1, 1);
        let check = check_deadline(now + Duration::days(50), now);
        assert_eq!(check.days_remaining, 50);
        assert!(!check.is_breached);
        assert!(check.is_approaching);
        assert_eq!(check.severity, "low");

        let boundary = check_deadline(now + Duration::days(90), now);
        assert_eq!(boundary.severity, "low");
        assert!(boundary.is_approaching);

        let just_over = check_deadline(now + Duration::days(91), now);
        assert_eq!(just_over.severity, "");
        assert!(!just_over.is_approaching);
    }

    #[test]
    fn check_deadline_medium_bucket_8_to_30_days() {
        let now = utc(2024, 1, 1);
        let check = check_deadline(now + Duration::days(20), now);
        assert_eq!(check.days_remaining, 20);
        assert!(!check.is_breached);
        assert!(check.is_approaching);
        assert_eq!(check.severity, "medium");

        assert_eq!(check_deadline(now + Duration::days(30), now).severity, "medium");
        assert_eq!(check_deadline(now + Duration::days(31), now).severity, "low");
    }

    #[test]
    fn check_deadline_high_bucket_1_to_7_days() {
        let now = utc(2024, 1, 1);
        let check = check_deadline(now + Duration::days(5), now);
        assert_eq!(check.days_remaining, 5);
        assert!(!check.is_breached);
        assert!(check.is_approaching);
        assert_eq!(check.severity, "high");

        assert_eq!(check_deadline(now + Duration::days(7), now).severity, "high");
        assert_eq!(check_deadline(now + Duration::days(8), now).severity, "medium");
    }

    #[test]
    fn check_deadline_critical_when_breached() {
        let now = utc(2024, 1, 1);
        let check = check_deadline(now - Duration::days(3), now);
        assert_eq!(check.days_remaining, -3);
        assert!(check.is_breached);
        assert!(!check.is_approaching);
        assert_eq!(check.severity, "critical");
    }

    #[test]
    fn lapse_stage_if_overdue_old_notification_lapses_for_larr() {
        let notif = utc(2024, 1, 1);
        let now = utc(2025, 2, 1); // 13 months later.
        let p = make_project(
            Authority::Larr,
            ProjectStage::PreliminaryNotification,
            Some(notif),
            notif,
        );
        assert_eq!(lapse_stage_if_overdue(&p, now), Some(ProjectStage::Lapsed));
    }

    #[test]
    fn lapse_stage_if_overdue_old_notification_lapses_for_nh() {
        let notif = utc(2024, 1, 1);
        let now = utc(2025, 2, 1); // 13 months later.
        let p = make_project(
            Authority::NationalHighways,
            ProjectStage::PreliminaryNotification,
            Some(notif),
            notif,
        );
        assert_eq!(lapse_stage_if_overdue(&p, now), Some(ProjectStage::Lapsed));
    }

    #[test]
    fn lapse_stage_if_overdue_recent_notification_is_not_lapsed() {
        let notif = utc(2024, 1, 1);
        let now = utc(2024, 7, 1); // 6 months later.
        let p = make_project(
            Authority::Larr,
            ProjectStage::PreliminaryNotification,
            Some(notif),
            notif,
        );
        assert_eq!(lapse_stage_if_overdue(&p, now), None);
    }

    #[test]
    fn lapse_stage_if_overdue_no_notification_is_not_lapsed() {
        let now = utc(2025, 2, 1);
        // Project in PreliminaryNotification but no notification_at recorded.
        let p = make_project(
            Authority::Larr,
            ProjectStage::PreliminaryNotification,
            None,
            utc(2024, 1, 1),
        );
        assert_eq!(lapse_stage_if_overdue(&p, now), None);
    }

    #[test]
    fn lapse_stage_if_overdue_declaration_no_award_lapses() {
        // Project in Declaration stage, last updated 13 months ago.
        let updated = utc(2024, 1, 1);
        let now = utc(2025, 2, 1);
        let p = make_project(Authority::Larr, ProjectStage::Declaration, None, updated);
        assert_eq!(lapse_stage_if_overdue(&p, now), Some(ProjectStage::Lapsed));
    }

    #[test]
    fn lapse_stage_if_overdue_declaration_within_year_is_not_lapsed() {
        let updated = utc(2024, 1, 1);
        let now = utc(2024, 7, 1); // 6 months later.
        let p = make_project(Authority::Larr, ProjectStage::Declaration, None, updated);
        assert_eq!(lapse_stage_if_overdue(&p, now), None);
    }

    #[test]
    fn lapse_stage_if_overdue_other_stages_are_untouched() {
        let notif = utc(2020, 1, 1); // Very old.
        let now = utc(2025, 2, 1);
        // Already in ObjectionPeriod — should not lapse under §22.3/§22.4.
        let p = make_project(
            Authority::Larr,
            ProjectStage::ObjectionPeriod,
            Some(notif),
            notif,
        );
        assert_eq!(lapse_stage_if_overdue(&p, now), None);
        // Already lapsed — should not be re-lapsed.
        let p2 = make_project(
            Authority::Larr,
            ProjectStage::Lapsed,
            Some(notif),
            notif,
        );
        assert_eq!(lapse_stage_if_overdue(&p2, now), None);
    }
}
