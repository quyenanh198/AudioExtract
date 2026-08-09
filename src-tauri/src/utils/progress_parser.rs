use regex::Regex;
use serde::{Serialize, Deserialize};
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub percent: f64,
    pub speed: String,
    pub eta: String,
}

static PROGRESS_REGEX: OnceLock<Regex> = OnceLock::new();

pub fn parse_progress_line(line: &str) -> Option<DownloadProgress> {
    let re = PROGRESS_REGEX.get_or_init(|| {
        Regex::new(r"\[download\]\s+(\d+\.?\d*)%\s+of\s+~?\s*([\d.]+\w+)\s+at\s+([\d.]+\w+/s)\s+ETA\s+(\d+:\d+)").unwrap()
    });

    if let Some(caps) = re.captures(line) {
        let percent = caps.get(1)?.as_str().parse::<f64>().unwrap_or(0.0);
        let speed = caps.get(3)?.as_str().to_string();
        let eta = caps.get(4)?.as_str().to_string();

        Some(DownloadProgress {
            percent,
            speed,
            eta,
        })
    } else {
        None
    }
}
