# Tell A Story

A Vite + React practice app for English students who are learning to narrate in the past.

Students choose from 20 generated visual scenes, write a free-text story, and receive coaching on how their verb forms relate to each other:

- past continuous for background actions
- simple past for completed story events
- past perfect for earlier past events
- connectors such as when, while, as, after, and before

## Run locally

```bash
npm install
npm run dev:all
```

Open the Vite URL shown in the terminal. The app proxies `/api/feedback` to the local coach server on port `8787`.

## AI feedback

Create a `.env` file if you want OpenAI feedback:

```bash
cp .env.example .env
```

Then add `OPENAI_API_KEY`. Without a key, the server uses a local grammar-coach fallback so the app still works.

The feedback engine is scene-aware. The image is the student stimulus, but the coach reads `sceneScript` from `src/data/scenes.js` to understand visible actions, narrative roles, useful connectors, and target verb relationships. This lets students write many valid stories instead of matching a fixed answer key.

## Image bank

The 20 practice scenes live in `src/data/scenes.js`. Scene images can be stored in `public/scenes/` and referenced with paths like `/scenes/midnight-knock.png`.

For the first scene, save the generated image as:

```text
public/scenes/midnight-knock.png
```

The app will use that PNG automatically. If the file is missing, it falls back to the built-in authored SVG illustration.

For high-quality feedback, pair each final image with:

- `coreActions`: visible actions and their preferred verb forms
- `relationships`: interruption, background action, cause/result, earlier past, or simultaneous action links
- `challengeModes`: beginner, intermediate, and advanced tasks
