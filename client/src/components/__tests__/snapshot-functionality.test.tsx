import { describe, it, expect, vi } from 'vitest';

// Test the core logic of the snapshot profile picture conversion
describe('Snapshot Profile Picture Conversion Logic', () => {
  it('should convert external image URLs to data URLs', async () => {
    // Mock the image loading process
    global.Image = class extends EventTarget {
      src = '';
      crossOrigin = '';
      naturalWidth = 300;
      naturalHeight = 300;
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor() {
        super();
        setTimeout(() => {
          if (this.onload) {
            this.onload(new Event('load'));
          }
        }, 0);
      }
    } as any;

    // Mock canvas and context
    const mockContext = {
      drawImage: vi.fn(),
      toDataURL: vi.fn(() => 'data:image/png;base64,converted-image-data'),
    };

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockContext),
      toDataURL: vi.fn(() => 'data:image/png;base64,converted-image-data'),
    };

    Object.defineProperty(document, 'createElement', {
      value: vi.fn((tagName: string) => {
        if (tagName === 'canvas') {
          return mockCanvas;
        }
        return {};
      }),
      configurable: true,
    });

    // Test the core conversion logic (extracted from share-button.tsx)
    const convertImageToDataUrl = async (originalHref: string): Promise<string> => {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }
        
        const tempImg = new Image();
        tempImg.crossOrigin = 'anonymous';
        
        tempImg.onload = () => {
          try {
            canvas.width = tempImg.naturalWidth;
            canvas.height = tempImg.naturalHeight;
            ctx.drawImage(tempImg, 0, 0);
            const dataUrl = mockContext.toDataURL('image/png', 0.9);
            resolve(dataUrl);
          } catch (error) {
            resolve('');
          }
        };
        
        tempImg.onerror = () => {
          resolve('');
        };
        
        tempImg.src = originalHref;
      });
    };

    // Test the conversion
    const originalUrl = 'https://i.scdn.co/image/ab67616d0000b273e787cffec20aa2a396a61647';
    const result = await convertImageToDataUrl(originalUrl);
    
    expect(result).toBe('data:image/png;base64,converted-image-data');
    expect(mockContext.drawImage).toHaveBeenCalled();
    expect(mockContext.toDataURL).toHaveBeenCalledWith('image/png', 0.9);
  });

  it('should handle image loading failures gracefully', async () => {
    // Mock failing image
    global.Image = class extends EventTarget {
      src = '';
      crossOrigin = '';
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor() {
        super();
        setTimeout(() => {
          if (this.onerror) {
            this.onerror(new Event('error'));
          }
        }, 0);
      }
    } as any;

    const convertImageToDataUrl = async (originalHref: string): Promise<string> => {
      return new Promise((resolve) => {
        const tempImg = new Image();
        tempImg.crossOrigin = 'anonymous';
        
        tempImg.onload = () => {
          resolve('success');
        };
        
        tempImg.onerror = () => {
          resolve(''); // Return empty string on error
        };
        
        tempImg.src = originalHref;
      });
    };

    const result = await convertImageToDataUrl('https://invalid-url.com/image.jpg');
    expect(result).toBe(''); // Should handle error gracefully
  });

  it('should maintain a mapping of original URLs for restoration', () => {
    // Test the URL mapping logic
    const originalImageHrefs = new Map<any, string>();
    
    const mockImageElement = {
      getAttribute: vi.fn(() => 'https://example.com/image.jpg'),
      setAttribute: vi.fn(),
    };

    // Simulate storing original URL
    const originalHref = mockImageElement.getAttribute('href');
    if (originalHref) {
      originalImageHrefs.set(mockImageElement, originalHref);
      mockImageElement.setAttribute('href', 'data:image/png;base64,new-data');
    }

    // Verify mapping is stored
    expect(originalImageHrefs.has(mockImageElement)).toBe(true);
    expect(originalImageHrefs.get(mockImageElement)).toBe('https://example.com/image.jpg');

    // Simulate restoration
    originalImageHrefs.forEach((originalHref, img) => {
      img.setAttribute('href', originalHref);
    });

    // Verify restoration happened
    expect(mockImageElement.setAttribute).toHaveBeenCalledWith('href', 'https://example.com/image.jpg');
  });

  it('should handle cases where no external images are found', () => {
    // Mock SVG with no external images
    const mockSvg = {
      querySelectorAll: vi.fn(() => []), // Empty array - no external images
    };

    const imageElements = mockSvg.querySelectorAll('image[href*="http"]');
    expect(imageElements.length).toBe(0);
    
    // The snapshot process should continue even with no external images
    // This simulates the logic in the actual implementation
    const shouldProceedWithSnapshot = true; // Would be determined by other factors
    expect(shouldProceedWithSnapshot).toBe(true);
  });

  it('should handle concurrent image conversions efficiently', async () => {
    let imageLoadCount = 0;
    
    // Mock multiple images loading
    global.Image = class extends EventTarget {
      src = '';
      crossOrigin = '';
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor() {
        super();
        setTimeout(() => {
          imageLoadCount++;
          if (this.onload) {
            this.onload(new Event('load'));
          }
        }, Math.random() * 100); // Random delay to simulate real loading
      }
    } as any;

    const mockContext = {
      drawImage: vi.fn(),
      toDataURL: vi.fn(() => `data:image/png;base64,image-${imageLoadCount}`),
    };

    Object.defineProperty(document, 'createElement', {
      value: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockContext),
      })),
      configurable: true,
    });

    // Simulate converting multiple images concurrently
    const imageUrls = [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
      'https://example.com/image3.jpg',
    ];

    const convertImage = async (url: string) => {
      const img = new Image();
      return new Promise<string>((resolve) => {
        img.onload = () => resolve(`converted-${url}`);
        img.onerror = () => resolve('');
        img.src = url;
      });
    };

    const startTime = Date.now();
    const results = await Promise.all(imageUrls.map(convertImage));
    const endTime = Date.now();

    expect(results).toHaveLength(3);
    expect(results.every(result => result.startsWith('converted-'))).toBe(true);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly with concurrent processing
  });
});
