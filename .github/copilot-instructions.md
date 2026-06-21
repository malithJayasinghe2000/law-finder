# GitHub Copilot Runtime Rules
- You are running inside GitHub Copilot linked to a local Ollama instance.
- When executing local tools or running commands like `run_in_terminal` or `read_page`, never output the raw JSON tool block text directly to the user.
- Instead, let the environment parse the execution silently, or fall back to writing clean Markdown text explaining what command needs to be run.
- Do not attempt agentic tool calls if you cannot format them natively; always default to giving standard text answers and step-by-step guidance.