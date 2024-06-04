"use client";

import { SunMoon } from "lucide-react";
import {
  useRef,
  useState,
  useId,
  useCallback,
  useEffect,
  type MutableRefObject,
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
import { cn } from "~/lib/utils";

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
      rotate: "N",
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
};

export default function Test() {
  const imageRef = useRef<HTMLImageElement>();

  const [black, setBlack] = useState([50]);
  const [size, setSize] = useState<Size>({ width: 0, height: 0, lock: true });
  const [result, setResult] = useState<string | undefined>(undefined);

  // TODO https://labelary.com/viewer.html redirect
  // https://labelary.com/viewer.html?density=8&width=4&height=2&units=inches&index=0&zpl=%5EXA%0A%5ECI28%0A%5ECF0%2C50%0A%5EFO100%2C100%5EFDJe%20n%C3%A4her%20dem%20Bein%2C%5EFS%0A%5EFO100%2C175%5EFDdesto%20s%C3%BC%C3%9Fer%20das%20Fleisch.%5EFS%0A%5EXZ

  return (
    <div className="mx-auto max-w-lg flex flex-col gap-2">
      <h1 className="text-3xl font-bold tracking-tight leading-normal">
        image-to-zpl
      </h1>

      <Dropzone imageRef={imageRef} setSize={setSize} />

      <div className="flex flex-row gap-2">
        <LabeledInput
          label="Width"
          value={size.width}
          setValue={(value) => setSize({ ...size, width: +value })}
        />
        <LabeledInput
          label="Height"
          value={size.height}
          setValue={(value) => setSize({ ...size, height: +value })}
        />
      </div>

      <LabeledInput label="TODO: Lock Ratio" />

      <Label>Darkness</Label>

      <Slider
        value={black}
        onValueChange={setBlack}
        min={0}
        max={100}
        step={1}
      />

      {black}

      <Button
        onClick={async () => {
          const zpl = await convert(imageRef.current, size, black);
          setResult(zpl);
        }}
        disabled={imageRef.current === null}
      >
        Convert
      </Button>

      {result && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-1">
            <Button variant="outline" className="w-full">
              Copy
            </Button>
            <Button variant="outline" className="w-full">
              Open Labelary
            </Button>
          </div>

          <div className="border rounded font-mono p-1 break-all text-sm font-medium max-h-96 overflow-y-auto">
            {result}
          </div>
        </div>
      )}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string | number;
  setValue: (value: string | number) => void;
}) {
  const id = useId();

  return (
    <div className="w-full">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type="number"
      />
    </div>
  );
}

function Dropzone({
  imageRef,
  setSize,
}: {
  imageRef: MutableRefObject<HTMLImageElement | undefined>;
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

  const imageRefCallback = useCallback(
    (img: HTMLImageElement) => {
      imageRef.current = img ?? undefined;

      if (img !== null) {
        setTimeout(() => {
          setSize({
            width: img.width,
            height: img.height,
            lock: true,
          });
        }, 100);
      }
    },
    [imageRef, setSize],
  );

  return (
    <div className="relative">
      <div
        {...getRootProps()}
        className={cn(
          "rounded-lg max-h-96 border text-center transition-all",
          url === undefined ? "p-8" : "p-4",
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
            ref={imageRefCallback}
            src={url}
            alt="Selected file can not be displayed as an image"
          />
        ) : isDragActive ? (
          <p>Drop the file here</p>
        ) : (
          <p>Drop image here or click to select files</p>
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
