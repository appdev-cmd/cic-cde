use rmcp::{
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::*,
    tool, tool_handler, tool_router, ServerHandler, ServiceExt,
};
use serde_json::{json, Value};
#[derive(Clone)]
struct BimServer {
    tool_router: ToolRouter<Self>,
    client: reqwest::Client,
}
#[derive(serde::Deserialize, schemars::JsonSchema)]
struct Search {
    query: String,
}
#[derive(serde::Deserialize, schemars::JsonSchema)]
struct CheckRequest {
    model_id: Option<String>,
    model_ids_a: Option<Vec<String>>,
    model_ids_b: Option<Vec<String>>,
    class_a: Option<String>,
    class_b: Option<String>,
    floor: Option<String>,
    tolerance_mm: Option<f64>,
}
#[tool_router]
impl BimServer {
    fn new() -> Self {
        Self {
            tool_router: Self::tool_router(),
            client: reqwest::Client::new(),
        }
    }
    async fn call(&self, operation: &str, input: Value) -> String {
        match self.client.post("http://127.0.0.1:4318/rpc").json(&json!({"operation":operation,"input":input})).send().await {
            Ok(r)=>r.text().await.unwrap_or_else(|e|e.to_string()),
            Err(_)=>json!({"error":"APP_NOT_RUNNING","message":"Start the local Rust core with pnpm core"}).to_string()
        }
    }
    #[tool(description = "Read the current QA BIM project from the local development core")]
    async fn project_get(&self) -> String {
        self.call("project.get", json!({})).await
    }
    #[tool(description = "List loaded IFC models in the current local development workspace")]
    async fn models_list(&self) -> String {
        self.call("models.list", json!({})).await
    }
    #[tool(description = "Search loaded elements by text, bounded to 100 results")]
    async fn elements_search(&self, Parameters(p): Parameters<Search>) -> String {
        self.call("elements.search", json!({"query":p.query,"limit":100}))
            .await
    }
    #[tool(
        description = "Run a bounded federated IFC intersection check. Select model_ids_a and model_ids_b from models_list; uses saved model transforms. Defaults to demo IFC, ducts versus beams, 2 mm. Saves evidence and does not close issues."
    )]
    async fn checks_run(&self, Parameters(p): Parameters<CheckRequest>) -> String {
        let fallback = p.model_id.unwrap_or("demo".into());
        self.call("checks.run",json!({"modelIdsA":p.model_ids_a.unwrap_or(vec![fallback.clone()]),"modelIdsB":p.model_ids_b.unwrap_or(vec![fallback]),
            "classA":p.class_a.unwrap_or("IfcDuctSegment".into()),"classB":p.class_b.unwrap_or("IfcBeam".into()),
            "floor":p.floor.unwrap_or("all".into()),"tolerance":p.tolerance_mm.unwrap_or(2.)/1000.})).await
    }
}
#[tool_handler]
impl ServerHandler for BimServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            instructions: Some(
                "QA BIM G1 development bridge: reads and bounded local geometry checks. No shell or arbitrary filesystem access."
                    .into(),
            ),
            ..Default::default()
        }
    }
}
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    BimServer::new()
        .serve(rmcp::transport::stdio())
        .await?
        .waiting()
        .await?;
    Ok(())
}
