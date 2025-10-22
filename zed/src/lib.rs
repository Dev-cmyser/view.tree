use zed_extension_api as zed;
use zed_extension_api::{LanguageServerId, Result};

struct ViewTreeExtension;

impl zed::Extension for ViewTreeExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        // Zero-config: require Node in PATH, run bundled server from zed/lsp-server/out/server/index.js
        let node = worktree.which("node").unwrap_or_else(|| "node".to_string());

        let cwd =
            std::env::current_dir().map_err(|e| format!("Cannot get current directory: {}", e))?;
        let server_js = cwd
            .join("lsp-server")
            .join("out")
            .join("server")
            .join("index.js");
        if !server_js.exists() {
            return Err(format!(
                "Bundled LSP server not found at {}",
                server_js.display()
            ));
        }
        let server_js_str = server_js.to_string_lossy().to_string();

        eprintln!(
            "view.tree LSP (Zed): {} {:?}",
            node,
            vec![server_js_str.clone(), "--stdio".to_string()]
        );

        Ok(zed::Command {
            command: node,
            args: vec![server_js_str, "--stdio".to_string()],
            env: Default::default(),
        })
    }
}

zed::register_extension!(ViewTreeExtension);
