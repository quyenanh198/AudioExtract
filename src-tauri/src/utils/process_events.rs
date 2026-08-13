use tauri::async_runtime::Receiver;
use tauri_plugin_shell::process::CommandEvent;

/// One line of output from a spawned command, tagged by which stream it came from.
pub enum CommandLine {
    Stdout(String),
    Stderr(String),
}

/// Drains a spawned command's event stream, invoking `on_line` for each
/// stdout/stderr line as it arrives, and returns the process's exit code
/// once it terminates (or `None` if the channel closed without ever
/// producing a `Terminated` event).
///
/// This is the shared shape behind every "spawn a sidecar, stream its
/// output, react when it exits" command handler in this codebase — extracted
/// so `download_audio` and `update_ytdlp` don't each reimplement the same
/// recv/match loop with their own chance to get it subtly wrong.
pub async fn drain_command_events(
    mut rx: Receiver<CommandEvent>,
    mut on_line: impl FnMut(CommandLine),
) -> Option<i32> {
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => {
                on_line(CommandLine::Stdout(String::from_utf8_lossy(&bytes).to_string()));
            }
            CommandEvent::Stderr(bytes) => {
                on_line(CommandLine::Stderr(String::from_utf8_lossy(&bytes).to_string()));
            }
            CommandEvent::Terminated(payload) => {
                return payload.code;
            }
            _ => {}
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::async_runtime::channel;

    #[tokio::test]
    async fn invokes_on_line_for_each_stdout_and_stderr_event_and_returns_exit_code() {
        let (tx, rx) = channel::<CommandEvent>(8);

        tx.send(CommandEvent::Stdout(b"line one".to_vec())).await.unwrap();
        tx.send(CommandEvent::Stderr(b"line two".to_vec())).await.unwrap();
        tx.send(CommandEvent::Terminated(tauri_plugin_shell::process::TerminatedPayload {
            code: Some(0),
            signal: None,
        }))
        .await
        .unwrap();

        let mut collected: Vec<String> = Vec::new();
        let exit_code = drain_command_events(rx, |line| {
            collected.push(match line {
                CommandLine::Stdout(s) => format!("out:{s}"),
                CommandLine::Stderr(s) => format!("err:{s}"),
            });
        })
        .await;

        assert_eq!(exit_code, Some(0));
        assert_eq!(collected, vec!["out:line one".to_string(), "err:line two".to_string()]);
    }

    #[tokio::test]
    async fn returns_none_if_channel_closes_without_a_terminated_event() {
        let (tx, rx) = channel::<CommandEvent>(1);
        drop(tx); // close the channel immediately, no events sent

        let exit_code = drain_command_events(rx, |_| {}).await;

        assert_eq!(exit_code, None);
    }
}
