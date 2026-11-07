import { jsPDF } from "jspdf";
import type Konva from "konva";
import type { ExportOptions } from "../components/ExportDialog";

const EXPORT_PIXEL_RATIO = 2;
const EXPORT_PADDING = 24;

const downloadDataUrl = (dataUrl: string, fileName: string) => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
};

const renderWhiteBackground = (dataUrl: string, width: number, height: number) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Không thể tạo canvas xuất ảnh"));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, width * EXPORT_PIXEL_RATIO, height * EXPORT_PIXEL_RATIO);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Không thể đọc ảnh snapshot"));
    image.src = dataUrl;
  });

const getExportBounds = (contentLayer: Konva.Layer, stage: Konva.Stage) => {
  const layerBounds = contentLayer.getClientRect({ relativeTo: stage });
  if (layerBounds.width <= 0 || layerBounds.height <= 0) {
    return {
      x: 0,
      y: 0,
      width: stage.width(),
      height: stage.height(),
    };
  }

  return {
    x: layerBounds.x - EXPORT_PADDING,
    y: layerBounds.y - EXPORT_PADDING,
    width: layerBounds.width + EXPORT_PADDING * 2,
    height: layerBounds.height + EXPORT_PADDING * 2,
  };
};

const createSnapshot = async (stage: Konva.Stage, contentLayer: Konva.Layer, background: "white" | "transparent") => {
  const bounds = getExportBounds(contentLayer, stage);
  const transparentDataUrl = stage.toDataURL({
    mimeType: "image/png",
    pixelRatio: EXPORT_PIXEL_RATIO,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  });
  const dataUrl =
    background === "white"
      ? await renderWhiteBackground(transparentDataUrl, bounds.width, bounds.height)
      : transparentDataUrl;

  return { dataUrl, width: bounds.width, height: bounds.height };
};

const normalizedFileName = (fileName: string, extension: string) => {
  const cleaned = fileName.trim().replace(/[<>:"/\\|?*]/g, "-");
  const baseName = cleaned || "whiteboard-export";
  return baseName.toLowerCase().endsWith(`.${extension}`) ? baseName : `${baseName}.${extension}`;
};

export const exportWhiteboard = async (
  stage: Konva.Stage,
  contentLayer: Konva.Layer,
  excludedLayers: Konva.Node[],
  options: ExportOptions
) => {
  const previousVisibility = excludedLayers.map((layer) => layer.visible());
  excludedLayers.forEach((layer) => layer.visible(false));
  stage.batchDraw();

  try {
    const snapshot = await createSnapshot(stage, contentLayer, options.format === "png" ? options.pngBackground : "white");
    if (options.format === "png") {
      downloadDataUrl(snapshot.dataUrl, normalizedFileName(options.fileName, "png"));
      return;
    }

    const orientation = options.pdfOrientation;
    const pdf = new jsPDF({ orientation, unit: "mm", format: options.pdfSize });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const scale = Math.min(pageWidth / snapshot.width, pageHeight / snapshot.height);
    const imageWidth = snapshot.width * scale;
    const imageHeight = snapshot.height * scale;
    pdf.addImage(snapshot.dataUrl, "PNG", (pageWidth - imageWidth) / 2, (pageHeight - imageHeight) / 2, imageWidth, imageHeight);
    pdf.save(normalizedFileName(options.fileName, "pdf"));
  } finally {
    excludedLayers.forEach((layer, index) => layer.visible(previousVisibility[index]));
    stage.batchDraw();
  }
};
