# AccessAI fonts

AccessAI self-hosts the following official font assets through `next/font/local`:

- Noto Sans Bengali variable font from the [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/notosansbengali), licensed under the SIL Open Font License 1.1. The license is kept beside the asset as `public/fonts/NotoSansBengali-OFL.txt`.
- Inter variable font from the [rsms/inter repository](https://github.com/rsms/inter), with its license kept as `public/fonts/Inter-LICENSE.txt`.
- JetBrains Mono variable font from the [JetBrains/JetBrainsMono repository](https://github.com/JetBrains/JetBrainsMono), licensed under the SIL Open Font License 1.1. The license is kept beside the asset as `public/fonts/JetBrainsMono-OFL.txt`.

This avoids runtime CSS imports and makes a clean production build independent of Google Fonts network access. Nirmala UI and Kalpurush remain named Bengali fallbacks for a damaged or unavailable local asset.
