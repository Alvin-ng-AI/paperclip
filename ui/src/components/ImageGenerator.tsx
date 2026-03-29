import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { imageGenerationApi } from "../api/image-generation";
import { ApiError } from "../api/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "../lib/utils";
import { Download, ImageIcon, Loader2, RefreshCw, Sparkles } from "lucide-react";

const STYLES = ["Lifestyle", "Product", "Flat Lay", "Studio", "Illustration"] as const;
const ASPECT_RATIOS = [
  { value: "1:1", label: "Square (1:1)" },
  { value: "16:9", label: "Landscape (16:9)" },
  { value: "9:16", label: "Portrait (9:16)" },
] as const;

const PRESET_PROMPTS = [
  "Premium pet necklace lifestyle photo, white background, soft lighting",
  "Dog wearing [product] accessories, outdoor park setting, golden hour",
  "Flat lay of pet accessories on marble surface, top-down shot",
  "Instagram ad for pet brand, pastel aesthetic, cute dog",
];

interface Props {
  companyId: string;
  className?: string;
}

export function ImageGenerator({ companyId, className }: Props) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<string | undefined>(undefined);
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "16:9" | "9:16">("1:1");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: () =>
      imageGenerationApi.generateImage(companyId, {
        prompt,
        style,
        aspectRatio,
      }),
    onSuccess: (data) => {
      setGeneratedUrl(data.imageUrl);
      setErrorMessage(null);
    },
    onError: (err) => {
      setGeneratedUrl(null);
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Something went wrong. Please try again.");
      }
    },
  });

  function handleGenerate() {
    if (!prompt.trim()) return;
    setErrorMessage(null);
    generateMutation.mutate();
  }

  function handlePreset(p: string) {
    setPrompt(p);
    setErrorMessage(null);
    setGeneratedUrl(null);
  }

  function handleDownload() {
    if (!generatedUrl) return;
    const a = document.createElement("a");
    a.href = generatedUrl;
    a.download = `generated-image-${Date.now()}.jpg`;
    a.click();
  }

  const isLoading = generateMutation.isPending;
  const aspectClass =
    aspectRatio === "16:9"
      ? "aspect-video"
      : aspectRatio === "9:16"
        ? "aspect-[9/16] max-h-96"
        : "aspect-square";

  return (
    <div className={cn("space-y-4", className)}>
      {/* Preset prompts */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Quick presets</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePreset(p)}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-accent/30 transition-colors text-left max-w-xs truncate"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt input */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Prompt
        </label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate..."
          className="text-sm resize-none min-h-[80px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleGenerate();
            }
          }}
        />
      </div>

      {/* Style + Aspect ratio */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Style</label>
          <Select value={style ?? ""} onValueChange={(v) => setStyle(v || undefined)}>
            <SelectTrigger className="text-sm h-8">
              <SelectValue placeholder="Any style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any style</SelectItem>
              {STYLES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Aspect ratio</label>
          <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as "1:1" | "16:9" | "9:16")}>
            <SelectTrigger className="text-sm h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={!prompt.trim() || isLoading}
        size="sm"
        className="w-full gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            Generate Image
          </>
        )}
      </Button>

      {/* Error state */}
      {errorMessage && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Generated image preview */}
      {isLoading && (
        <div
          className={cn(
            "w-full rounded-lg border border-border bg-muted/30 flex flex-col items-center justify-center gap-2",
            aspectClass,
          )}
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Generating your image…</p>
        </div>
      )}

      {generatedUrl && !isLoading && (
        <div className="space-y-2">
          <div className={cn("w-full rounded-lg overflow-hidden border border-border", aspectClass)}>
            <img
              src={generatedUrl}
              alt="Generated"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={handleGenerate}>
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </Button>
          </div>
        </div>
      )}

      {!generatedUrl && !isLoading && !errorMessage && (
        <div
          className={cn(
            "w-full rounded-lg border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-2 text-muted-foreground",
            aspectClass,
          )}
        >
          <ImageIcon className="h-8 w-8" />
          <p className="text-xs">Your generated image will appear here</p>
        </div>
      )}
    </div>
  );
}
