# osu-json-parser

```typescript
import fs from "fs";
import OsuParser from "osu-json-parser";
import readline from "readline";

const rl = readline.createInterface({
  input: fs.createReadStream(
    "data/cosMo@BousouP feat.Hatsune Miku - Hatsune Miku no Shoushitsu (val0108) [Extra].osu",
  ),
});

const parser = new OsuParser();

rl.on("line", (line) => {
  parser.parse(line);
});

rl.on("close", () => {
  console.log(parser.toJSON());
});

```
