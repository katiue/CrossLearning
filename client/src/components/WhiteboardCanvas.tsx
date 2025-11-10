import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Pen, Download, Trash2 } from "lucide-react";
import { axiosClient } from "@/helper/axiosClient";
import { toast } from "react-toastify";

interface WhiteboardCanvasProps {
  sessionId: string;
}

export default function WhiteboardCanvas({ sessionId }: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#ffffff");
  const [lineWidth, setLineWidth] = useState(3);
  const [drawingData, setDrawingData] = useState<any[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Set initial background
    context.fillStyle = "#1f2937";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    const context = canvas.getContext("2d");
    if (context) {
      context.beginPath();
      context.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    context.strokeStyle = tool === "eraser" ? "#1f2937" : color;
    context.lineWidth = tool === "eraser" ? lineWidth * 3 : lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";

    context.lineTo(x, y);
    context.stroke();

    // Store drawing data
    setDrawingData((prev) => [
      ...prev,
      { x, y, tool, color, lineWidth, timestamp: Date.now() },
    ]);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (context) {
      context.closePath();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.fillStyle = "#1f2937";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setDrawingData([]);
  };

  const saveDrawing = async () => {
    try {
      await axiosClient.post(`/teach-sessions/sessions/${sessionId}/whiteboard`, {
        drawing_data: { points: drawingData },
      });
      toast.success("Whiteboard saved!");
    } catch (error) {
      toast.error("Failed to save whiteboard");
      console.error(error);
    }
  };

  const downloadDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-gray-900 rounded-t-lg border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={tool === "pen" ? "default" : "outline"}
            onClick={() => setTool("pen")}
          >
            <Pen className="h-4 w-4 mr-1" />
            Pen
          </Button>
          
          <Button
            size="sm"
            variant={tool === "eraser" ? "default" : "outline"}
            onClick={() => setTool("eraser")}
          >
            <Eraser className="h-4 w-4 mr-1" />
            Eraser
          </Button>

          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-16 rounded border border-gray-600 cursor-pointer"
            disabled={tool === "eraser"}
          />

          <input
            type="range"
            min="1"
            max="20"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-sm text-gray-400">{lineWidth}px</span>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={saveDrawing}>
            Save
          </Button>
          
          <Button size="sm" variant="outline" onClick={downloadDrawing}>
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
          
          <Button size="sm" variant="destructive" onClick={clearCanvas}>
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-gray-800 rounded-b-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="w-full h-full cursor-crosshair"
        />
      </div>
    </div>
  );
}
