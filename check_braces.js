
const fs = require("fs");
const code = fs.readFileSync("src/context/AppContext.tsx", "utf8");
let inString = false;
let stringChar = "";
let inLineComment = false;
let inBlockComment = false;
const stack = [];

for (let i = 0; i < code.length; i++) {
  const c = code[i];
  const next = code[i+1];
  
  if (inLineComment) {
    if (c === "\n") inLineComment = false;
    continue;
  }
  if (inBlockComment) {
    if (c === "*" && next === "/") { inBlockComment = false; i++; }
    continue;
  }
  if (inString) {
    if (c === "\\") { i++; continue; }
    if (c === stringChar) { inString = false; }
    continue;
  }
  
  if (c === "/" && next === "/") { inLineComment = true; i++; continue; }
  if (c === "/" && next === "*") { inBlockComment = true; i++; continue; }
  if (c === "\"" || c === "'" || c === "`") { inString = true; stringChar = c; continue; }
  
  if (c === "{") {
    const line = code.slice(0, i).split("\n").length;
    stack.push(line);
  } else if (c === "}") {
    stack.pop();
  }
}
console.log("Unclosed braces opened at lines:", stack);
