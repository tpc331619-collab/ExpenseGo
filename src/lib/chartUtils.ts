import { toBlob } from 'html-to-image';

export const copyChart = async (containerElement: HTMLElement | null, fileName: string) => {
    if (!containerElement) return;
    try {
        const blob = await toBlob(containerElement, {
            backgroundColor: '#ffffff',
            cacheBust: true,
            pixelRatio: 2,
            filter: (node) => {
                // Exclude the copy button from the snapshot
                if (node instanceof HTMLElement && node.classList.contains('btn-icon-sub')) {
                    return false;
                }
                return true;
            }
        });

        if (blob) {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ [blob.type]: blob })
                ]);
                alert('全區快照已複製！可直接貼上至報告。');
            } catch (err) {
                const link = document.createElement('a');
                link.download = `${fileName}.png`;
                link.href = URL.createObjectURL(blob);
                link.click();
                alert('已下載圖表全區圖片。');
            }
        }
    } catch (e) {
        console.error(e);
        alert('複製失敗，建議使用系統內建截圖功能。');
    }
};
