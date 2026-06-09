import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

export async function exportElementToImage(elementId: string, filename: string) {
  const node = document.getElementById(elementId);
  if (!node) return;
  const canvas = await html2canvas(node, { backgroundColor: '#fff', scale: 2 });
  canvas.toBlob((blob) => {
    if (blob) saveAs(blob, filename);
  });
}
