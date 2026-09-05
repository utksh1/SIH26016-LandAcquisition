use sih_api::{app, AppState};
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    let address: SocketAddr = std::env::var("BIND_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:3000".to_string())
        .parse()
        .expect("BIND_ADDR must be a valid socket address");
    
    let secret = std::env::var("SIH_DEV_AUTH_SECRET")
        .unwrap_or_else(|_| "sih-local-demo-secret-change-me".to_string());
    let auth = sih_api::DevAuth::new(secret).expect("valid auth secret");
    
    let pool = if let Ok(database_url) = std::env::var("DATABASE_URL") {
        match sih_domain::db::create_pool(&database_url).await {
            Ok(p) => {
                println!("Connected to PostgreSQL at {database_url}");
                Some(p)
            }
            Err(e) => {
                eprintln!("CRITICAL: PostgreSQL database unreachable ({}). Database connection is required. Data endpoints will return 503 Service Unavailable.", e);
                None
            }
        }
    } else {
        eprintln!("CRITICAL: DATABASE_URL environment variable is not set. Database connection is required. Data endpoints will return 503 Service Unavailable.");
        None
    };

    let state = AppState::new(pool, auth);
    state.sync_from_db().await;
    
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .expect("failed to bind listener");
    
    println!("SIH26016 API listening on http://{address}");
    axum::serve(listener, app(state))
        .await
        .expect("server failed");
}
