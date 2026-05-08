const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT_DIR = path.join(__dirname, '..');

// ==========================================
// STATIC DEFAULTS ALLOWLIST
// Add to this object to enable local saving
// for new features. Maps client API key to
// the constant name in config.js.
// ==========================================
const DEFAULT_WRITES = {
  concretePresets: "DEFAULT_CONCRETE_PRESETS",
  goldenRatioDefaults: "DEFAULT_GR",
  materialPresets: "DEFAULT_MATERIAL_PRESETS"
};

const toStringField = value => value == null ? "" : String(value);

const toNumberOrBlank = value => {
  if (value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throwValidationError(`Expected a number or empty string, got ${JSON.stringify(value)}`);
  }
  return n;
};

function throwValidationError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  throw err;
}

function validateConcretePresets(value) {
  if (!Array.isArray(value)) {
    throwValidationError("concretePresets must be an array");
  }

  return value.map((preset, idx) => {
    if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
      throwValidationError(`concretePresets[${idx}] must be an object`);
    }

    return {
      name: toStringField(preset.name),
      rate: toNumberOrBlank(preset.rate),
      bagKg: toNumberOrBlank(preset.bagKg),
      bagPrice: toNumberOrBlank(preset.bagPrice)
    };
  });
}

function validateGoldenRatioDefaults(value) {
  if (!Array.isArray(value)) {
    throwValidationError("goldenRatioDefaults must be an array");
  }

  return value.map((item, idx) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throwValidationError(`goldenRatioDefaults[${idx}] must be an object`);
    }

    const id = toStringField(item.id);
    if (!/^[a-z][a-z0-9_-]{0,15}$/i.test(id)) {
      throwValidationError(`goldenRatioDefaults[${idx}].id must be a short id string`);
    }

    const valueText = toStringField(item.value);
    const suffixText = toStringField(item.suffix);

    return {
      id,
      value: valueText,
      suffix: suffixText,
      saved: {
        value: valueText,
        suffix: suffixText
      },
      savedCommitted: valueText.trim() !== ""
    };
  });
}

function validateMaterialPresets(value) {
  if (!Array.isArray(value)) {
    throwValidationError("materialPresets must be an array");
  }

  return value.map((preset, idx) => {
    if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
      throwValidationError(`materialPresets[${idx}] must be an object`);
    }

    return {
      name: toStringField(preset.name),
      length: toNumberOrBlank(preset.length),
      width: toNumberOrBlank(preset.width)
    };
  });
}

const DEFAULT_VALIDATORS = {
  concretePresets: validateConcretePresets,
  goldenRatioDefaults: validateGoldenRatioDefaults,
  materialPresets: validateMaterialPresets
};

// Robust bracket matcher to safely replace constant values
function replaceConstant(source, constName, newValue) {
  const decl = `const ${constName} = `;
  const startIdx = source.indexOf(decl);
  if (startIdx === -1) return null;

  const afterDecl = startIdx + decl.length;
  let braceIdx = -1;
  let isArray = false;
  
  for (let i = afterDecl; i < source.length; i++) {
    if (source[i] === '[') { braceIdx = i; isArray = true; break; }
    if (source[i] === '{') { braceIdx = i; isArray = false; break; }
    if (source[i] !== ' ' && source[i] !== '\n' && source[i] !== '\r') break;
  }
  
  if (braceIdx === -1) {
    const semiIdx = source.indexOf(';', afterDecl);
    if (semiIdx === -1) return null;
    return source.slice(0, afterDecl) + JSON.stringify(newValue, null, 2) + source.slice(semiIdx);
  }

  const open = isArray ? '[' : '{';
  const close = isArray ? ']' : '}';
  let depth = 0;
  let inString = false;
  let stringChar = null;
  let escape = false;
  let endIdx = -1;

  for (let i = braceIdx; i < source.length; i++) {
    const char = source[i];
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    
    if (inString) {
      if (char === stringChar) inString = false;
    } else {
      if (char === '"' || char === "'" || char === '`') {
        inString = true;
        stringChar = char;
      } else if (char === open) {
        depth++;
      } else if (char === close) {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
  }

  if (endIdx === -1) return null;

  let formattedValue = JSON.stringify(newValue, null, 2);
  // Strip quotes from object keys to look like standard JS
  formattedValue = formattedValue.replace(/"([a-zA-Z0-9_]+)":/g, "$1:");

  return source.slice(0, braceIdx) + formattedValue + source.slice(endIdx + 1);
}

const server = http.createServer((req, res) => {
  // API Endpoint for saving defaults
  if (req.method === 'POST' && req.url === '/api/save-defaults') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { key, value } = payload;

        if (!DEFAULT_WRITES[key]) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Unknown save key: ${key}` }));
          return;
        }

        const constantName = DEFAULT_WRITES[key];
        const validatedValue = DEFAULT_VALIDATORS[key](value);
        const configPath = path.join(ROOT_DIR, 'config.js');
        
        let configData = fs.readFileSync(configPath, 'utf8');
        
        const newConfigData = replaceConstant(configData, constantName, validatedValue);
        if (!newConfigData) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Could not parse constant ${constantName} in config.js` }));
          return;
        }

        fs.writeFileSync(configPath, newConfigData, 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, key, constantName }));
      } catch (err) {
        console.error("Save error:", err);
        res.writeHead(err.statusCode || 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static File Serving
  if (req.method === 'GET') {
    // Strip query parameters
    let requestUrl = req.url.split('?')[0];
    let filePath = path.join(ROOT_DIR, requestUrl === '/' ? 'index.html' : requestUrl);
    
    // Prevent directory traversal attacks
    if (!filePath.startsWith(ROOT_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.svg': 'image/svg+xml'
    };
    
    fs.readFile(filePath, (err, content) => {
      if (err) {
        if(err.code == 'ENOENT') {
          res.writeHead(404);
          res.end('File not found');
        } else {
          res.writeHead(500);
          res.end('Server error: ' + err.code);
        }
      } else {
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        res.end(content, 'utf-8');
      }
    });
  }
});

server.listen(PORT, () => {
  console.log(`Local dev server running at http://localhost:${PORT}/`);
  console.log(`Ready to save static defaults for: ${Object.keys(DEFAULT_WRITES).join(', ')}`);
});
