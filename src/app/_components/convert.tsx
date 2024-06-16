"use client";

import { Lock, RefreshCw, RotateCcw, RotateCw, SunMoon } from "lucide-react";
import {
  useRef,
  useState,
  useId,
  useCallback,
  useEffect,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useDropzone } from "react-dropzone";
import * as zpl from "zpl-image";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Toggle } from "~/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { cn } from "~/lib/utils";

type Rotation = "L" | "I" | "R" | undefined;

async function loadPako() {
  if (window.pako !== undefined) {
    return;
  }
  window.pako = (await import("pako")).default;
}

async function convert(
  image: HTMLImageElement | null,
  size: Size,
  black: number,
  rotation: Rotation,
) {
  if (image === null) {
    return;
  }

  await loadPako();

  const res = imageToACS(image as CanvasImageSource, {
    height: size.height,
    width: size.width,
    zplOptions: {
      black,
      notrim: true,
      rotate: rotation,
    },
  });

  return `^GFA,${res.length},${res.length},${res.rowlen},${res.acs}`;
}

function imageToACS(
  image: CanvasImageSource,
  {
    zplOptions,
    width,
    height,
  }: {
    zplOptions?: zpl.Options;
    width: number;
    height: number;
  },
) {
  // Draw the image to a temp canvas so we can access its RGBA data
  const cvs = document.createElement("canvas");
  const ctx = cvs.getContext("2d")!;

  cvs.width = width;
  cvs.height = height;

  ctx.imageSmoothingQuality = "high"; // in case canvas needs to scale image
  ctx.drawImage(image, 0, 0, cvs.width, cvs.height);

  const pixels = ctx.getImageData(0, 0, cvs.width, cvs.height);
  return zpl.rgbaToACS(pixels.data, pixels.width, zplOptions);
}

type Size = {
  width: number;
  height: number;
  lock: boolean;
  originalRatio: number;
};

function computeSize(prevSize: Size, width: number): Size {
  if (!prevSize.lock) {
    return {
      ...prevSize,
      width,
    };
  }

  return {
    ...prevSize,
    width,
    height: Math.round(prevSize.originalRatio * width),
  };
}

function setSizeLock(prevSize: Size, locked: boolean): Size {
  if (!locked) {
    return {
      ...prevSize,
      lock: false,
    };
  }

  return {
    ...prevSize,
    height: Math.round(prevSize.originalRatio * prevSize.width),
    lock: true,
  };
}

export default function ImageToZpl() {
  const imageRef = useRef<HTMLImageElement>(null);

  const [black, setBlack] = useState([50]);
  const [size, setSize] = useState<Size>({
    width: 0,
    height: 0,
    lock: true,
    originalRatio: 0,
  });
  const [result, setResult] = useState<string | undefined>(undefined);
  const [rotation, setRotation] = useState<Rotation>(undefined);

  useEffect(() => {
    setResult("");
  }, [size, black, rotation]);

  return (
    <div className="mx-auto max-w-lg flex flex-col gap-2 px-2 md:px-0 py-2">
      <ImageDropzone imageRef={imageRef} setSize={setSize} />

      <div className="flex flex-row gap-2 place-items-end">
        <LabeledInput
          label="Width"
          value={size.width}
          setValue={(value) => setSize((prev) => computeSize(prev, +value))}
        />
        <Toggle
          aria-label="Toggle size ratio lock"
          variant="outline"
          pressed={size.lock}
          onPressedChange={(pressed) =>
            setSize((prev) => setSizeLock(prev, pressed))
          }
        >
          <Lock className="w-4 h-4" />
        </Toggle>
        <LabeledInput
          label="Height"
          value={size.height}
          setValue={(value) => setSize({ ...size, height: +value })}
          disabled={size.lock}
        />
      </div>

      <div className="space-y-1">
        <Label>Darkness</Label>

        <Slider
          value={black}
          onValueChange={setBlack}
          min={0}
          max={100}
          step={1}
        />
      </div>

      {/* TODO add tooltips? */}
      <RotationToggleGroup value={rotation ?? ""} setValue={setRotation} />

      <Button
        onClick={async () => {
          const zpl = await convert(
            imageRef.current,
            size,
            black[0]!,
            rotation,
          );
          setResult(zpl);
        }}
        disabled={imageRef.current === undefined}
      >
        Convert
      </Button>

      {result && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-1">
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => await navigator.clipboard.writeText(result)}
            >
              Copy
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                window.open(buildLabelaryLink(result, size, rotation), "_blank")
              }
            >
              Open in Labelary
            </Button>
          </div>

          {result.length > 8000 && (
            <div className="text-xs text-right">
              <span className="font-semibold">Open in Labelary</span> might not
              work for large images
            </div>
          )}

          <div className="border rounded font-mono p-1 break-all text-sm font-medium max-h-96 overflow-y-auto">
            {result}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs text-foreground/90">
          The conversion is done offline using the{" "}
          <a
            href="https://github.com/metafloor/zpl-image"
            className="underline-offset-4 hover:underline font-semibold"
            target="_blank"
          >
            zpl-image
          </a>{" "}
          library, images do not leave your device.
        </div>
        <div className="text-xs text-muted-foreground">
          Found any issues? Let me know on{" "}
          <a
            href="https://github.com/hiimnit/image-to-zpl/issues/new"
            className="underline-offset-4 hover:underline font-semibold"
            target="_blank"
          >
            github
          </a>
          .
        </div>
      </div>
    </div>
  );
}

function LabeledInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    value: string | number;
    setValue: (value: string | number) => void;
  },
) {
  const id = useId();

  const { label, value, setValue, ...other } = props;

  return (
    <div className="w-full">
      <Label htmlFor={id}>{label}</Label>
      <Input
        {...other}
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type="number"
      />
    </div>
  );
}

function ImageDropzone({
  imageRef,
  setSize,
}: {
  imageRef: RefObject<HTMLImageElement>;
  setSize: Dispatch<SetStateAction<Size>>;
}) {
  const [url, setUrl] = useState<string | undefined>(undefined);

  const onDrop = useCallback((files: File[]) => {
    if (files === null || files.length === 0) {
      setUrl(undefined);
      return;
    }

    const objectURL = window.URL.createObjectURL(files[0]!);
    setUrl(objectURL);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  useEffect(() => {
    if (url === undefined) {
      return;
    }

    return () => {
      window.URL.revokeObjectURL(url);
    };
  }, [url]);

  const [lightBgColor, setLightBgColor] = useState(false);

  return (
    <div className="relative space-y-2 sm:space-y-0">
      <div
        {...getRootProps()}
        className={cn(
          "rounded-lg max-h-[48rem] border text-center transition-all flex items-center justify-center overflow-auto select-none cursor-pointer",
          url === undefined ? "p-8" : "p-2",
          lightBgColor
            ? "bg-foreground text-background"
            : "bg-background text-foreground",
          isDragActive &&
            "ring-2 ring-slate-300 ring-offset-slate-900 ring-offset-1",
        )}
      >
        <input {...getInputProps()} />

        {url !== undefined ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imageRef}
            onLoad={(e) => {
              const img = e.target as HTMLImageElement;
              setSize({
                width: img.naturalWidth,
                height: img.naturalHeight,
                lock: true,
                originalRatio:
                  img.naturalWidth !== 0
                    ? img.naturalHeight / img.naturalWidth
                    : 0,
              });
            }}
            src={url}
            className="max-h-[40rem]"
            alt="Selected file can not be displayed as an image"
          />
        ) : isDragActive ? (
          <>Drop the file here</>
        ) : (
          <>Drop image here or click to select files</>
        )}
      </div>

      <Toggle
        aria-label="Toggle background color"
        variant="outline"
        pressed={lightBgColor}
        onPressedChange={setLightBgColor}
        className="sm:absolute -right-14 top-0"
      >
        <SunMoon className="h-5 w-5" />
      </Toggle>
    </div>
  );
}

function RotationToggleGroup({
  value,
  setValue,
}: {
  value: string;
  setValue: Dispatch<SetStateAction<"R" | "L" | "I" | undefined>>;
}) {
  return (
    <div>
      <Label htmlFor="rotate-toggles">Rotate</Label>
      <ToggleGroup
        id="rotate-toggles"
        type="single"
        className="justify-start"
        value={value}
        onValueChange={(e) => {
          if (e === "R" || e === "L" || e === "I") {
            setValue(e);
            return;
          }
          setValue(undefined);
        }}
      >
        <ToggleGroupItem value="L" variant="outline" aria-label="Rotate left">
          <RotateCcw className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="I"
          variant="outline"
          aria-label="Rotate around/Invert"
        >
          <RefreshCw className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="R" variant="outline" aria-label="Rotate right">
          <RotateCw className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

function buildLabelaryLink(
  imageZpl: string,
  size: { width: number; height: number },
  rotation: Rotation,
) {
  const swapSize = rotation === "L" || rotation === "R";

  const dpiPerMM = 8;
  const width = Math.round((swapSize ? size.height : size.width) / dpiPerMM);
  const height = Math.round((swapSize ? size.width : size.height) / dpiPerMM);

  const zpl = `^XA${imageZpl}^XZ`;

  return `https://labelary.com/viewer.html?density=${dpiPerMM}&width=${width}&height=${height}&units=mm&index=0&zpl=${zpl}`;
}
