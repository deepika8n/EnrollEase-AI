export async function createImagePreview(source = "", maxSide = 600) {
  if (!String(source).startsWith("data:image/")) return "";
  return new Promise(resolve => {
    const image = new Image();
    const timer = setTimeout(() => resolve(""), 15000);
    image.onerror = () => { clearTimeout(timer); resolve(""); };
    image.onload = () => {
      clearTimeout(timer);
      try {
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch { resolve(""); }
    };
    image.src = source;
  });
}
