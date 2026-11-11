#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if std::env::args().any(|arg| arg == "--create-user") {
        use std::io::Read;
        let mut input = String::new();
        std::io::stdin().read_to_string(&mut input)?;
        let value: serde_json::Value = serde_json::from_str(&input)?;
        let result =
            qabim_application::security::create_user(&value).map_err(std::io::Error::other)?;
        println!("{}", result);
        return Ok(());
    }
    eprintln!("CIC CDE core: http://127.0.0.1:4318");
    qabim_host::serve(qabim_application::Application::default()).await
}
