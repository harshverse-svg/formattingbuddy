from PIL import Image, ImageDraw

def create_icon(size, output_path):
    # Create image with RGBA
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    scale = size / 512.0
    
    # Outer rounded rectangle (Indigo #5B5BD6)
    radius = int(112 * scale)
    draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=(91, 91, 214, 255))
    
    # Document sheet (White #FFFFFF)
    doc_x0 = int(116 * scale)
    doc_y0 = int(86 * scale)
    doc_x1 = int((116 + 280) * scale)
    doc_y1 = int((86 + 340) * scale)
    doc_rad = int(20 * scale)
    draw.rounded_rectangle([doc_x0, doc_y0, doc_x1, doc_y1], radius=doc_rad, fill=(255, 255, 255, 255))
    
    # Fold corner accent (#E0E2FD)
    f_x0 = int(326 * scale)
    f_y0 = int(86 * scale)
    f_x1 = int(396 * scale)
    f_y1 = int(156 * scale)
    draw.polygon([(f_x0, f_y0), (f_x1, f_y1), (int(346 * scale), f_y1), (f_x0, int(136 * scale))], fill=(224, 226, 253, 255))
    
    # Header bar (#5B5BD6)
    draw.rounded_rectangle([int(156 * scale), int(146 * scale), int((156 + 130) * scale), int((146 + 18) * scale)], radius=int(9 * scale), fill=(91, 91, 214, 255))
    
    # Line 1 (#9CA3AF)
    draw.rounded_rectangle([int(156 * scale), int(184 * scale), int((156 + 200) * scale), int((184 + 10) * scale)], radius=int(5 * scale), fill=(156, 163, 175, 255))
    # Line 2 (#D1D5DB)
    draw.rounded_rectangle([int(156 * scale), int(206 * scale), int((156 + 170) * scale), int((206 + 10) * scale)], radius=int(5 * scale), fill=(209, 213, 219, 255))
    
    # Mini chart container (#F3F4F6)
    draw.rounded_rectangle([int(156 * scale), int(246 * scale), int((156 + 200) * scale), int((246 + 80) * scale)], radius=int(10 * scale), fill=(243, 244, 246, 255))
    
    # Chart bars
    draw.rounded_rectangle([int(180 * scale), int(286 * scale), int((180 + 20) * scale), int((286 + 30) * scale)], radius=int(4 * scale), fill=(91, 91, 214, 255))
    draw.rounded_rectangle([int(216 * scale), int(266 * scale), int((216 + 20) * scale), int((266 + 50) * scale)], radius=int(4 * scale), fill=(129, 140, 248, 255))
    draw.rounded_rectangle([int(252 * scale), int(276 * scale), int((252 + 20) * scale), int((276 + 40) * scale)], radius=int(4 * scale), fill=(91, 91, 214, 255))
    draw.rounded_rectangle([int(288 * scale), int(256 * scale), int((288 + 20) * scale), int((256 + 60) * scale)], radius=int(4 * scale), fill=(129, 140, 248, 255))
    
    # Green dot (#10B981)
    cx, cy, cr = int(330 * scale), int(270 * scale), int(10 * scale)
    draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(16, 185, 129, 255))
    
    # Bottom lines
    draw.rounded_rectangle([int(156 * scale), int(348 * scale), int((156 + 180) * scale), int((348 + 10) * scale)], radius=int(5 * scale), fill=(156, 163, 175, 255))
    draw.rounded_rectangle([int(156 * scale), int(370 * scale), int((156 + 120) * scale), int((370 + 10) * scale)], radius=int(5 * scale), fill=(209, 213, 219, 255))
    
    img.save(output_path, "PNG")
    print(f"Generated {output_path} ({size}x{size})")

if __name__ == "__main__":
    create_icon(192, "assets/icons/icon-192.png")
    create_icon(512, "assets/icons/icon-512.png")
