import { useState, useEffect, useRef, useCallback } from 'react';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { Code2, Eye, Copy, Check, RotateCcw, ZoomIn, ZoomOut, Maximize, Sparkles, Download, Workflow } from 'lucide-react';
import { cn } from './lib/utils';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  themeVariables: {
    fontFamily: '"Inter", sans-serif',
  },
  securityLevel: 'loose',
});

const DEFAULT_CODE = `graph TD
    A([Start Process]):::start --> B{Is it valid?}:::decision
    B -->|Yes| C[Process Data]:::success
    B -->|No| D[Log Error]:::danger
    C --> E[(Save to DB)]:::success
    D --> F[Notify Admin]:::danger
    E --> G([Finish]):::start
    F --> G

    classDef start fill:#f9c74f,stroke:#f3722c,stroke-width:2px,color:#000
    classDef decision fill:#a0c4ff,stroke:#03045e,stroke-width:2px,color:#000
    classDef success fill:#caffbf,stroke:#38b000,stroke-width:2px,color:#000
    classDef danger fill:#ffadad,stroke:#c1121f,stroke-width:2px,color:#000

    linkStyle default stroke:#a3a3a3,stroke-width:2px
`;

const AI_MERMAID_PROMPT = `You are generating Mermaid.js diagram code (v11). Follow these rules strictly:

SYNTAX RULES:
1. Use "graph TD" (top-down) or "graph LR" (left-right) for flowcharts.
2. Node shapes: [rectangle], (rounded), {diamond/decision}, ([stadium]), [(cylinder)], ((circle)), [/parallelogram/], [\\trapezoid\\].
3. Arrow types: --> (solid), -.-> (dotted), ==> (thick), -->|label| (labeled arrow).
4. Subgraphs: "subgraph Title ... end".

COLOR & STYLING RULES (CRITICAL):
- DO NOT use the ":::" shorthand class syntax. It is unreliable across diagram types.
- Define styles at the END of the diagram using classDef and explicit class assignment.
- Pattern:
    classDef className fill:#hex,stroke:#hex,stroke-width:2px,color:#hex,font-weight:bold
    class NodeA,NodeB className
- For individual nodes, use:
    style NodeA fill:#hex,stroke:#hex,stroke-width:2px,color:#hex
- For edges/links, use:
    linkStyle 0 stroke:#hex,stroke-width:2px
    (0 = first link in order of appearance, 1 = second, etc.)
    linkStyle default stroke:#hex,stroke-width:2px

COLOR PALETTE GUIDELINES:
- Use harmonious, accessible color palettes. Good sets:
  - Warm: #f9c74f (yellow), #f8961e (orange), #f3722c (red-orange), #f94144 (red)
  - Cool: #a0c4ff (light blue), #90be6d (green), #bdb2ff (lavender), #43aa8b (teal)
  - Neutral: #fafafa (white), #e5e5e5 (light gray), #737373 (mid gray), #171717 (near black)
- Ensure text color contrasts with fill (dark text on light fills, light text on dark fills).
- Use stroke colors that are darker variants of the fill.

EXAMPLE:
\`\`\`mermaid
graph TD
    A([Start]) --> B{Decision?}
    B -->|Yes| C[Process]
    B -->|No| D[Error]
    C --> E[(Database)]
    D --> F[Alert]
    E --> G([End])
    F --> G

    classDef start fill:#f9c74f,stroke:#e09f3e,stroke-width:2px,color:#000
    classDef decide fill:#a0c4ff,stroke:#3a86ff,stroke-width:2px,color:#000
    classDef good fill:#caffbf,stroke:#38b000,stroke-width:2px,color:#000
    classDef bad fill:#ffadad,stroke:#d00000,stroke-width:2px,color:#000

    class A,G start
    class B decide
    class C,E good
    class D,F bad

    linkStyle default stroke:#a3a3a3,stroke-width:2px
\`\`\`

ALWAYS return ONLY the raw mermaid code inside a mermaid code block.`;

function ZoomControls({ scale }: { scale: number }) {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-neutral-200 rounded-xl shadow-sm p-1 z-10">
      <button onClick={() => zoomOut(0.3)} title="Zoom out" className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors">
        <ZoomOut className="w-4 h-4" />
      </button>
      <span className="text-[11px] text-neutral-500 tabular-nums min-w-[40px] text-center select-none">
        {Math.round(scale * 100)}%
      </span>
      <button onClick={() => zoomIn(0.3)} title="Zoom in" className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors">
        <ZoomIn className="w-4 h-4" />
      </button>
      <div className="w-px h-4 bg-neutral-200 mx-0.5" />
      <button onClick={() => resetTransform()} title="Reset view" className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors">
        <Maximize className="w-4 h-4" />
      </button>
    </div>
  );
}

function MermaidPreview({ chart, onSvgChange }: { chart: string; onSvgChange?: (svg: string) => void }) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [scale, setScale] = useState(1);
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const renderChart = async () => {
      try {
        // Wait for fonts so Mermaid measures text with the correct metrics
        await document.fonts.ready;

        // Use custom neutral theme unless the user specifies their own
        const hasThemeDirective = /%%\{.*init.*\}%%/i.test(chart);
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: hasThemeDirective ? 'default' : 'base',
          themeVariables: hasThemeDirective
            ? { fontFamily: '"Inter", sans-serif' }
            : {
              primaryColor: '#ffffff',
              primaryTextColor: '#171717',
              primaryBorderColor: '#e5e5e5',
              lineColor: '#a3a3a3',
              secondaryColor: '#fafafa',
              tertiaryColor: '#ffffff',
              fontFamily: '"Inter", sans-serif',
            },
        });

        const id = `mermaid-svg-${Math.random().toString(36).substring(2, 11)}`;
        await mermaid.parse(chart);
        const { svg } = await mermaid.render(id, chart);

        if (isMounted) {
          setSvg(svg);
          onSvgChange?.(svg);
          setError('');
          // Force TransformWrapper to re-mount and recenter
          setRenderKey(k => k + 1);
        }
      } catch (e) {
        if (isMounted) {
          let errorMessage = 'Syntax error';
          if (e instanceof Error) errorMessage = e.message;
          else if (typeof e === 'string') errorMessage = e;
          else if (e && typeof e === 'object' && 'message' in e) errorMessage = String((e as any).message);
          else if (e && typeof e === 'object' && 'str' in e) errorMessage = String((e as any).str);

          setError(errorMessage);
        }
      }
    };

    if (chart.trim()) {
      renderChart();
    } else {
      setSvg('');
      setError('');
    }

    return () => {
      isMounted = false;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="max-w-lg w-full bg-red-50 border border-red-200 rounded-xl p-5">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">Syntax Error</p>
          <p className="text-sm text-red-600 leading-relaxed whitespace-pre-wrap break-words font-mono">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <TransformWrapper
        key={renderKey}
        initialScale={1}
        minScale={0.1}
        maxScale={8}
        centerOnInit
        limitToBounds={false}
        smooth
        wheel={{ smoothStep: 0.04 }}
        onTransformed={(_ref, state) => setScale(state.scale)}
      >
        <ZoomControls scale={scale} />
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: 'fit-content', height: 'fit-content' }}
        >
          <div
            className="mermaid-wrapper p-10"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}

function IconButton({
  onClick,
  title,
  children,
  active
}: {
  onClick?: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded-lg transition-all duration-150",
        active
          ? "bg-neutral-900 text-white shadow-sm"
          : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
      )}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [code, setCode] = useState<string>(DEFAULT_CODE);
  const [copied, setCopied] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [svgContent, setSvgContent] = useState('');
  const [editorWidth, setEditorWidth] = useState(38);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  }, [code]);

  const handleCopyPrompt = useCallback(() => {
    navigator.clipboard.writeText(AI_MERMAID_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 1000);
  }, []);

  const handleDownload = useCallback(() => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, [svgContent]);

  const handleReset = useCallback(() => {
    setCode(DEFAULT_CODE);
  }, []);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setEditorWidth(Math.min(70, Math.max(20, pct)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleEditorScroll = useCallback(() => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const lineCount = code.split('\n').length;

  return (
    <div className="flex flex-col h-screen w-full bg-neutral-50 text-neutral-900 selection:bg-neutral-200">
      {/* Header */}
      <header className="flex items-center justify-between px-5 h-14 border-b border-neutral-200 bg-white shrink-0">
        <h1 className="header-brand flex items-center gap-2 text-sm font-medium tracking-tight select-none">
          <Workflow className="w-3.5 h-3.5" />
          MermaidEditor
        </h1>

        <div className="flex items-center gap-1">
          <IconButton onClick={handleCopyPrompt} title="Copy AI prompt for Mermaid styling">
            {copiedPrompt ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          </IconButton>
          <div className="w-px h-4 bg-neutral-200 mx-0.5" />
          <IconButton onClick={handleCopy} title="Copy code">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </IconButton>
          <IconButton onClick={handleDownload} title="Download SVG">
            <Download className="w-4 h-4" />
          </IconButton>
          <IconButton onClick={handleReset} title="Reset to default">
            <RotateCcw className="w-4 h-4" />
          </IconButton>
        </div>
      </header>

      {/* Workspace */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Editor Panel */}
        <div className="flex flex-col overflow-hidden bg-white" style={{ width: `${editorWidth}%` }}>
          <div className="flex items-center gap-2 px-4 h-10 border-b border-neutral-200 bg-neutral-50/80 shrink-0">
            <Code2 className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-[11px] font-medium text-neutral-500 tracking-wide uppercase">Editor</span>
            <span className="ml-auto text-[11px] text-neutral-300 tabular-nums">{lineCount} lines</span>
          </div>
          <div className="flex flex-1 overflow-hidden">
            {/* Line numbers gutter */}
            <div
              ref={gutterRef}
              className="flex flex-col py-4 pl-4 pr-2 text-right select-none shrink-0 overflow-hidden bg-neutral-50/50 border-r border-neutral-100"
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <span key={i} className="text-[13px] leading-[1.7] text-neutral-300 font-mono tabular-nums">
                  {i + 1}
                </span>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              className="editor-textarea w-full h-full py-4 pl-3 pr-4 bg-white resize-none"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onScroll={handleEditorScroll}
              spellCheck="false"
              placeholder="Write your mermaid syntax here..."
            />
          </div>
        </div>

        {/* Resize Handle */}
        <div className="resize-handle w-[5px] border-x border-neutral-200" onMouseDown={handleMouseDown} />

        {/* Preview Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <div className="flex items-center gap-2 px-4 h-10 border-b border-neutral-200 bg-neutral-50/80 shrink-0">
            <Eye className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-[11px] font-medium text-neutral-500 tracking-wide uppercase">Preview</span>
          </div>
          <div className="flex-1 overflow-hidden dot-grid">
            <MermaidPreview chart={code} onSvgChange={setSvgContent} />
          </div>
        </div>
      </div>
    </div>
  );
}