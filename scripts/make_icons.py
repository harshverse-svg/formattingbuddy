from PIL import Image, ImageDraw

def create_icon(size, output_path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size / 512.0

    # Background rounded rectangle (#4F5BD5)
    radius = int(120 * scale)
    draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=(79, 91, 213, 255))

    # Document sheet (#F5F8FD with #D3DCEC outline)
    doc_x0 = int(110 * scale)
    doc_y0 = int(80 * scale)
    doc_x1 = int((110 + 292) * scale)
    doc_y1 = int((80 + 352) * scale)
    doc_rad = int(24 * scale)
    draw.rounded_rectangle([doc_x0, doc_y0, doc_x1, doc_y1], radius=doc_rad, fill=(245, 248, 253, 255), outline=(211, 220, 236, 255), width=int(3 * scale))

    # Fold corner (#D3DCEC)
    f_x0 = int(322 * scale)
    f_y0 = int(80 * scale)
    f_x1 = int(402 * scale)
    f_y1 = int(160 * scale)
    draw.polygon([(f_x0, f_y0), (f_x1, f_y1), (int(346 * scale), f_y1), (f_x0, int(136 * scale))], fill=(211, 220, 236, 255))

    # Header bar (#4F5BD5)
    draw.rounded_rectangle([int(150 * scale), int(146 * scale), int((150 + 130) * scale), int((146 + 18) * scale)], radius=int(9 * scale), fill=(79, 91, 213, 255))
    draw.rounded_rectangle([int(150 * scale), int(184 * scale), int((150 + 190) * scale), int((184 + 10) * scale)], radius=int(5 * scale), fill=(91, 103, 128, 255))
    draw.rounded_rectangle([int(150 * scale), int(206 * scale), int((150 + 160) * scale), int((206 + 10) * scale)], radius=int(5 * scale), fill=(142, 154, 184, 255))

    # Diagram box container (#EAF0FA)
    dia_x0 = int(150 * scale)
    dia_y0 = int(248 * scale)
    dia_x1 = int((150 + 212) * scale)
    dia_y1 = int((248 + 96) * scale)
    draw.rounded_rectangle([dia_x0, dia_y0, dia_x1, dia_y1], radius=int(14 * scale), fill=(234, 240, 250, 255), outline=(211, 220, 236, 255), width=int(2 * scale))

    # Node A (#4F5BD5)
    na_x, na_y, nr = int(186 * scale), int(296 * scale), int(14 * scale)
    draw.ellipse([na_x - nr, na_y - nr, na_x + nr, na_y + nr], fill=(79, 91, 213, 255))

    # Connecting line 1
    draw.line([(int(200 * scale), int(296 * scale)), (int(242 * scale), int(296 * scale))], fill=(79, 91, 213, 255), width=int(4 * scale))

    # Node B (#0284C7)
    nb_x, nb_y, nbs = int(242 * scale), int(284 * scale), int(24 * scale)
    draw.rounded_rectangle([nb_x, nb_y, nb_x + nbs, nb_y + nbs], radius=int(6 * scale), fill=(2, 132, 199, 255))

    # Connecting line 2
    draw.line([(int(266 * scale), int(296 * scale)), (int(308 * scale), int(296 * scale))], fill=(79, 91, 213, 255), width=int(4 * scale))

    # Node C (#0D9488)
    nc_x, nc_y, ncr = int(322 * scale), int(296 * scale), int(14 * scale)
    draw.ellipse([nc_x - ncr, nc_y - ncr, nc_x + ncr, nc_y + ncr], fill=(13, 148, 136, 255))

    # Bottom lines
    draw.rounded_rectangle([int(150 * scale), int(366 * scale), int((150 + 200) * scale), int((366 + 10) * scale)], radius=int(5 * scale), fill=(91, 103, 128, 255))
    draw.rounded_rectangle([int(150 * scale), int(388 * scale), int((150 + 130) * scale), int((388 + 10) * scale)], radius=int(5 * scale), fill=(142, 154, 184, 255))

    # Sparkle Star (#FBBF24)
    sp_cx, sp_cy = int(410 * scale), int(110 * scale)
    sp_r = int(35 * scale)
    # Simple diamond star
    draw.polygon([
        (sp_cx, sp_cy - sp_r),
        (sp_cx + int(sp_r * 0.35), sp_cy - int(sp_r * 0.35)),
        (sp_cx + sp_r, sp_cy),
        (sp_cx + int(sp_r * 0.35), sp_cy + int(sp_r * 0.35)),
        (sp_cx, sp_cy + sp_r),
        (sp_cx - int(sp_r * 0.35), sp_cy + int(sp_r * 0.35)),
        (sp_cx - sp_r, sp_cy),
        (sp_cx - int(sp_r * 0.35), sp_cy - int(sp_r * 0.35))
    ], fill=(251, 191, 36, 255))

    img.save(output_path, "PNG")
    print(f"Generated {output_path} ({size}x{size})")

if __name__ == "__main__":
    create_icon(192, "assets/icons/icon-192.png")
    create_icon(512, "assets/icons/icon-512.png")
