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
        // Resolve node from PATH (require Node to be installed)
        let node = worktree.which("node").unwrap_or_else(|| "node".to_string());

        // Server entry: ../out/server/index.js relative to the extension root (zed/)
        let cwd =
            std::env::current_dir().map_err(|e| format!("Cannot get current directory: {}", e))?;
        let server_js = cwd.join("..").join("out").join("server").join("index.js");
        let server_js_str = server_js.to_string_lossy().to_string();

        eprintln!(
            "view.tree LSP (Zed): node={} script={} --stdio",
            node, server_js_str
        );

        Ok(zed::Command {
            command: node,
            args: vec![server_js_str, "--stdio".to_string()],
            env: Default::default(),
        })
    }
}

zed::register_extension!(ViewTreeExtension);
