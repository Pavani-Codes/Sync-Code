import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';

export class MonacoBinding {
  doc: Y.Doc;
  ytext: Y.Text;
  monacoModel: any;
  editors: Set<any>;
  awareness: Awareness | null;
  private _mux: boolean = false;
  private _observer: (event: Y.YTextEvent) => void;
  private _disposables: Array<{ dispose: () => void }> = [];

  constructor(
    ytext: Y.Text,
    monacoModel: any,
    editors: Set<any> = new Set(),
    awareness: Awareness | null = null
  ) {
    this.doc = ytext.doc!;
    this.ytext = ytext;
    this.monacoModel = monacoModel;
    this.editors = editors;
    this.awareness = awareness;

    // Sync initial text from Yjs if exists
    const initialText = ytext.toString();
    if (monacoModel.getValue() !== initialText && initialText.length > 0) {
      monacoModel.setValue(initialText);
    }

    // 1. Listen for remote Yjs updates -> apply to Monaco
    this._observer = (event: Y.YTextEvent) => {
      if (this._mux) return;
      this._mux = true;
      try {
        let index = 0;
        event.delta.forEach((op) => {
          if (op.retain !== undefined) {
            index += op.retain;
          } else if (op.insert !== undefined) {
            const pos = monacoModel.getPositionAt(index);
            monacoModel.applyEdits([
              {
                range: {
                  startLineNumber: pos.lineNumber,
                  startColumn: pos.column,
                  endLineNumber: pos.lineNumber,
                  endColumn: pos.column,
                },
                text: op.insert as string,
                forceMoveMarkers: true,
              },
            ]);
            index += (op.insert as string).length;
          } else if (op.delete !== undefined) {
            const posStart = monacoModel.getPositionAt(index);
            const posEnd = monacoModel.getPositionAt(index + op.delete);
            monacoModel.applyEdits([
              {
                range: {
                  startLineNumber: posStart.lineNumber,
                  startColumn: posStart.column,
                  endLineNumber: posEnd.lineNumber,
                  endColumn: posEnd.column,
                },
                text: '',
                forceMoveMarkers: true,
              },
            ]);
          }
        });
      } finally {
        this._mux = false;
      }
    };
    ytext.observe(this._observer);

    // 2. Listen for local Monaco edits -> apply to Yjs
    const d = monacoModel.onDidChangeContent((event: any) => {
      if (this._mux) return;
      this._mux = true;
      try {
        this.doc.transact(() => {
          // Apply changes in reverse order to preserve string indices
          const changes = [...event.changes].sort(
            (a, b) => b.rangeOffset - a.rangeOffset
          );
          for (const change of changes) {
            if (change.rangeLength > 0) {
              ytext.delete(change.rangeOffset, change.rangeLength);
            }
            if (change.text.length > 0) {
              ytext.insert(change.rangeOffset, change.text);
            }
          }
        }, this);
      } finally {
        this._mux = false;
      }
    });
    this._disposables.push(d);
  }

  destroy() {
    this.ytext.unobserve(this._observer);
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }
}