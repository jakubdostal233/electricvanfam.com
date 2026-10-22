# Bundled fonts - licensing

Both families are licensed under the **SIL Open Font License, Version 1.1** (full text in [`OFL.txt`](./OFL.txt)). They are re-downloadable with [`fetch-fonts.sh`](./fetch-fonts.sh) (latin + latin-ext subsets, only the weights the templates use).

| Family         | Used for                                                                                        | Copyright                         | Source                                     |
| -------------- | ----------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------ |
| Inter          | body and display sans: jdsign's `type.body` and `type.display`, every skin but `scholarly`      | © 2016 The Inter Project Authors  | https://github.com/rsms/inter              |
| JetBrains Mono | code and monospaced text: jdsign's `type.mono`, the `--font-mono` of every skin but `scholarly` | © 2020 The JetBrains Mono Authors | https://github.com/JetBrains/JetBrainsMono |

Delivery: files were pulled from [google-webfonts-helper](https://gwfh.mranftl.com) -> `fonts.gstatic.com`. The OFL permits bundling and self-hosting; this directory keeps the license alongside the fonts as the license requires.
