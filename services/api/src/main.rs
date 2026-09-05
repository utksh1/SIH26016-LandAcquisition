use sih_api::{app, AppState};
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    let address: SocketAddr = std::env::var("BIND_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:3000".to_string())
        .parse()
        .expect("BIND_ADDR must be a valid socket address");
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .expect("failed to bind listener");
    let state = AppState::from_env().expect(
        "SIH_DEV_AUTH_SECRET must be configured (at least 16 bytes); the API uses signed development tokens only",
    );
    println!("SIH26016 API listening on http://{address}");
    axum::serve(listener, app(state))
        .await
        .expect("server failed");
}
