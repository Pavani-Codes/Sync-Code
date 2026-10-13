import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const router = Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { language, code } = req.body;

  if (!code) {
    res.status(400).json({ output: 'Error: No code provided for execution.' });
    return;
  }

  const tempDir = path.join(process.cwd(), 'temp_exec');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const lang = (language || 'javascript').toLowerCase();

  try {
    if (lang === 'javascript' || lang === 'js') {
      const filePath = path.join(tempDir, `script_${Date.now()}.js`);
      fs.writeFileSync(filePath, code);

      exec(`node "${filePath}"`, { timeout: 8000 }, (error, stdout, stderr) => {
        fs.unlinkSync(filePath); // Clean up temp file
        if (error) {
          res.json({ output: stderr || error.message });
        } else {
          res.json({ output: stdout || 'Code executed successfully (no output).' });
        }
      });
    } else if (lang === 'python' || lang === 'py') {
      const filePath = path.join(tempDir, `script_${Date.now()}.py`);
      fs.writeFileSync(filePath, code);

      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      exec(`${pythonCmd} "${filePath}"`, { timeout: 8000 }, (error, stdout, stderr) => {
        fs.unlinkSync(filePath);
        if (error) {
          res.json({ output: stderr || error.message });
        } else {
          res.json({ output: stdout || 'Code executed successfully (no output).' });
        }
      });
    } else if (lang === 'java') {
      // Find class name from code or default to hello/Main
      const classNameMatch = code.match(/class\s+([A-Za-z0-9_]+)/);
      const className = classNameMatch ? classNameMatch[1] : 'Main';
      const filePath = path.join(tempDir, `${className}.java`);

      fs.writeFileSync(filePath, code);

      exec(`javac "${filePath}" && java -cp "${tempDir}" ${className}`, { timeout: 10000 }, (error, stdout, stderr) => {
        // Clean up files
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        const classFilePath = path.join(tempDir, `${className}.class`);
        if (fs.existsSync(classFilePath)) fs.unlinkSync(classFilePath);

        if (error) {
          res.json({ output: stderr || error.message });
        } else {
          res.json({ output: stdout || 'Java execution completed (no output).' });
        }
      });
    } else if (lang === 'cpp' || lang === 'c++') {
      const filePath = path.join(tempDir, `main_${Date.now()}.cpp`);
      const outPath = path.join(tempDir, `main_${Date.now()}.exe`);

      fs.writeFileSync(filePath, code);

      exec(`g++ "${filePath}" -o "${outPath}" && "${outPath}"`, { timeout: 10000 }, (error, stdout, stderr) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

        if (error) {
          res.json({ output: stderr || error.message });
        } else {
          res.json({ output: stdout || 'C++ execution completed (no output).' });
        }
      });
    } else {
      res.json({ output: `Execution for language '${lang}' is running in preview mode.\n\nCode Preview:\n${code}` });
    }
  } catch (err: any) {
    res.status(500).json({ output: `Execution Exception: ${err?.message || 'Unknown error'}` });
  }
});

export default router;