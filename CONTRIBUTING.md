# Contributing to OpenGEO

Thank you for your interest in contributing to OpenGEO! We welcome contributions of all kinds: bug fixes, documentation improvements, new LLM adapters, CMS delivery plugins, and feature suggestions.

## Development Workflow

1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/open-geo.git
   cd open-geo
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
5. Start development server with file watching:
   ```bash
   npm run dev
   ```

## Code Guidelines

- **Zero Unnecessary Dependencies**: Keep the project lightweight, robust, and fast.
- **Node.js Native APIs**: Use modern Node.js features (such as `node:sqlite`) instead of bloated external drivers.
- **Security First**: Always sanitize user inputs and enforce rate limits.
- **Human-in-the-Loop Integrity**: Any AI-generated publishing pipeline must maintain human review boundaries.

## Pull Request Guidelines

1. Create a feature branch (`git checkout -b feature/my-new-feature`).
2. Commit your changes (`git commit -am 'Add some feature'`).
3. Push to the branch (`git push origin feature/my-new-feature`).
4. Open a Pull Request on GitHub with a clear description of the problem and solution.
