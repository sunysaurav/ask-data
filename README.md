# AskData AI Chat for Power BI

> **AI-powered data chat assistant for Power BI. Chat with OpenAI, Google Gemini, or Anthropic Claude about your data.**

[![Version](https://img.shields.io/badge/version-1.0.0.1-blue.svg)](https://github.com/sunysaurav/ask-data)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📖 Overview

**AskData AI Chat** brings the power of advanced Large Language Models (LLMs) directly into your Power BI reports. By integrating this custom visual, you can empower your users to interactively query, analyze, and discover insights from their dataset using natural language. 

Whether you prefer OpenAI, Google Gemini, or Anthropic Claude, AskData provides a seamless conversational interface to unlock the hidden value in your data without writing complex DAX queries.

## ✨ Features

- **Multi-Model Support:** Seamlessly connect and chat using industry-leading LLMs:
  - OpenAI (GPT-3.5/GPT-4)
  - Google Gemini
  - Anthropic Claude
- **Context-Aware Analytics:** The AI understands the context of your Power BI data model and responds accurately based on the current context and filters.
- **Interactive Chat Interface:** A sleek, user-friendly chat UI built with React directly within the visual.
- **Dynamic Queries:** Generate actionable insights, summaries, and explanations of your data on the fly.
- **Secure & Enterprise-Ready:** Configure your own API keys securely. Data stays within your environment as per your API configurations.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18.x or higher recommended)
- Power BI Visuals CLI (`pbiviz`)
- An active API key for your chosen LLM provider (OpenAI, Gemini, or Claude).

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sunysaurav/ask-data.git
   cd askData
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install Power BI tools:**
   ```bash
   npm install -g powerbi-visuals-api
   ```

4. **Start the development server:**
   ```bash
   npm start
   ```
   *This runs `pbiviz start` and compiles the visual.*

5. **Test in Power BI Service:**
   - Open Power BI Service.
   - Go to any report in Edit mode.
   - Add a Developer Visual.
   - The visual will connect to your local development server.

### Packaging for Production

To create a `.pbiviz` package that you can import into Power BI Desktop or Service:

```bash
npm run package
```
This generates a file in the `dist/` directory, which you can distribute and install in any Power BI environment.

## ⚙️ Configuration

Once added to a Power BI report, configure the visual through the Formatting Pane:

1. **API Selection**: Choose your preferred LLM provider.
2. **API Key**: Enter your secure API key for the selected provider.
3. **Data Roles**: Assign the necessary data fields you want the AI to analyze and provide insights upon.
4. **Appearance**: Customize the chat interface to match your corporate branding.

## 🛠️ Technology Stack

- [Power BI Custom Visuals API](https://github.com/microsoft/PowerBI-visuals) (v5.3.0)
- TypeScript
- React 18
- LESS (for styling)
- Webpack

## 🤝 Contributing

We welcome contributions! If you have suggestions, bug reports, or want to contribute code:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 📞 Support

If you encounter any issues or have questions, please contact us at [support@askdata.ai](mailto:support@askdata.ai) or open an issue on our [GitHub repository](https://github.com/sunysaurav/ask-data/issues).
