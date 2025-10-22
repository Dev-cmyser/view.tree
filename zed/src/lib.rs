use zed_extension_api::settings::LspSettings;
use zed_extension_api::{self as zed, LanguageServerId, Result};

// Constants for the View.Tree LSP

const EXECUTABLE_NAME: &str = "lsp";

struct ViewTreeBinary {
    path: String,
    args: Option<Vec<String>>,
}

struct ViewTreeLSPExtension {
    cached_binary_path: Option<String>,
}

impl ViewTreeLSPExtension {
    fn language_server_binary(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<ViewTreeBinary> {
        let binary_settings = LspSettings::for_worktree("zed-view.tree-mol-support", worktree)
            .ok()
            .and_then(|lsp_settings| lsp_settings.binary);
        let binary_args = binary_settings
            .as_ref()
            .and_then(|binary_settings| binary_settings.arguments.clone());

        // If the user has specified a custom path to the language server, use that
        if let Some(path) = binary_settings.and_then(|binary_settings| binary_settings.path) {
            return Ok(ViewTreeBinary {
                path,
                args: binary_args,
            });
        }

        // If the Go binary is available in PATH, use that
        if let Some(path) = worktree.which(EXECUTABLE_NAME) {
            return Ok(ViewTreeBinary {
                path,
                args: binary_args,
            });
        }

        // Check if we have a cached binary
        if let Some(ref cached_path) = self.cached_binary_path {
            let cached_binary = std::env::current_dir()
                .map(|dir| dir.join(cached_path).join(EXECUTABLE_NAME))
                .ok()
                .and_then(|path| {
                    if path.exists() {
                        Some(path.to_string_lossy().to_string())
                    } else {
                        None
                    }
                });

            if let Some(binary_path) = cached_binary {
                return Ok(ViewTreeBinary {
                    path: binary_path,
                    args: binary_args,
                });
            } else {
                self.cached_binary_path = None;
            }
        }

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::Downloading,
        );

        // Download Go binary release from GitHub

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::Downloading,
        );

        // Download Go binary release from GitHub
        let source_tarball_url = format!(
            "https://github.com/Dev-cmyser/lsp-view.tree/releases/download/v1.3.1/lsp-go-binary.tar.gz",
        );

        eprintln!("LSP Debug: Downloading from URL: {}", source_tarball_url);

        zed::download_file(
            &source_tarball_url,
            "lsp-go-binary.tar.gz",
            zed::DownloadedFileType::GzipTar,
        )
        .map_err(|err| format!("Failed to download view.tree LSP server: {}", err))?;

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::None,
        );

        // After extraction by Zed, the directory structure is: lsp-go-binary/
        let source_dir = "lsp-go-binary.tar.gz/lsp-go-binary";

        // Create absolute path to the Go binary
        let current_dir =
            std::env::current_dir().map_err(|e| format!("Cannot get current directory: {}", e))?;
        let final_binary_path = current_dir.join(&source_dir).join(EXECUTABLE_NAME);
        let final_binary_path_str = final_binary_path.to_string_lossy().to_string();

        // Check if the Go binary exists and make it executable
        match std::fs::metadata(&final_binary_path) {
            Ok(metadata) => {
                // Make binary executable on Unix systems
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mut perms = metadata.permissions();
                    perms.set_mode(0o755);
                    std::fs::set_permissions(&final_binary_path, perms)
                        .map_err(|e| format!("Cannot set executable permissions: {}", e))?;
                }

                // Cache the successful path
                self.cached_binary_path = Some(source_dir.to_string());

                Ok(ViewTreeBinary {
                    path: final_binary_path_str,
                    args: binary_args,
                })
            }
            Err(_) => {
                Err(format!("LSP binary not found at: {}. Please check the release archive contains the binary.", final_binary_path_str))
            }
        }
    }
}

impl zed::Extension for ViewTreeLSPExtension {
    fn new() -> Self {
        Self {
            cached_binary_path: None,
        }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let binary = self.language_server_binary(language_server_id, worktree)?;

        eprintln!(
            "view.tree LSP: Starting server with command: {}",
            binary.path
        );
        if let Some(ref args) = binary.args {
            eprintln!("view.tree LSP: Arguments: {:?}", args);
        }

        Ok(zed::Command {
            command: binary.path,
            args: binary.args.unwrap_or_else(|| vec![]),
            env: Default::default(),
        })
    }
}

zed::register_extension!(ViewTreeLSPExtension);
