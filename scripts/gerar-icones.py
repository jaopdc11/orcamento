#!/usr/bin/env python3
"""Gera os ícones do PWA a partir do código, não de um binário perdido no repo.

    python3 scripts/gerar-icones.py

Desenho: fundo escuro do app e três barras — duas baixas e uma alta em verde.
Lê como "orçamento" de longe e continua legível a 16px, que é o tamanho onde
ícone com detalhe vira borrão.
"""

from PIL import Image, ImageDraw
from pathlib import Path

PUBLICO = Path(__file__).resolve().parent.parent / "public"

FUNDO = (11, 15, 20)
BARRA_APAGADA = (37, 48, 60)
BARRA_VIVA = (94, 201, 140)

# Desenha grande e reduz: antialiasing de graça, sem depender de rasterizador SVG.
ESCALA = 8


def desenhar(lado: int, margem_segura: float) -> Image.Image:
    """margem_segura: fração das bordas deixada livre (ícone maskable é cortado
    em círculo por alguns launchers do Android)."""
    px = lado * ESCALA
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    raio = px * 0.22
    d.rounded_rectangle([0, 0, px - 1, px - 1], radius=raio, fill=FUNDO)

    util = px * (1 - 2 * margem_segura)
    base = px * margem_segura + util

    larg = util * 0.22
    vao = (util - 3 * larg) / 2
    alturas = [0.45, 0.68, 1.0]
    cores = [BARRA_APAGADA, BARRA_APAGADA, BARRA_VIVA]

    for i, (h, cor) in enumerate(zip(alturas, cores)):
        x0 = px * margem_segura + i * (larg + vao)
        altura = util * h
        d.rounded_rectangle(
            [x0, base - altura, x0 + larg, base],
            radius=larg * 0.35,
            fill=cor,
        )

    return img.resize((lado, lado), Image.LANCZOS)


def main() -> None:
    PUBLICO.mkdir(exist_ok=True)

    # 192/512: o manifest usa o mesmo arquivo como 'any' e 'maskable', então a
    # margem precisa servir aos dois — daí 18%, e não zero.
    for lado in (192, 512):
        desenhar(lado, 0.18).save(PUBLICO / f"icon-{lado}.png")

    # apple-touch-icon nunca é mascarado e fica sobre o fundo do iOS: margem menor.
    desenhar(180, 0.14).save(PUBLICO / "apple-touch-icon.png")

    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#0b0f14"/>
  <rect x="18" y="47.2" width="14.4" height="34.8" rx="5" fill="#25303c"/>
  <rect x="42.8" y="36.8" width="14.4" height="45.2" rx="5" fill="#25303c"/>
  <rect x="67.6" y="18" width="14.4" height="64" rx="5" fill="#5ec98c"/>
</svg>
"""
    (PUBLICO / "favicon.svg").write_text(svg, encoding="utf-8")

    for f in sorted(PUBLICO.iterdir()):
        print(f"  {f.name}  {f.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
