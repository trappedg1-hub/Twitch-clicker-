# CANON LOCK — дословный блок для каждой генерации

Этот текст подставляется в `generate_image` **без изменений** перед блоком костюма и позы.
Менять в нём нельзя ни слова: любая правка = дрейф лица. Меняются только два последних
абзаца — `COSTUME` и `POSE`, и `BACKGROUND` при необходимости.

Референс-картинка к каждому вызову: `deliverables/concept/canon_ref_sheet.png`
(голова дня 1 + корпус дня 1). Только эти файлы, никакие другие.

---

```
STYLE LOCK — match the supplied reference plate exactly:
clean thin dark grey lineart over soft airbrushed cel shading, semi-realistic anime game key art,
smooth gradients inside every form, no heavy black outlines, no flat vector fills,
hard linework only in the hair and the lashes, glossy dewy specular highlights on the nose tip,
lips, collarbones, shoulders and the front of the thighs.

IDENTITY LOCK — the face must be identical to the reference and must not be reinterpreted:
soft rounded oval, short smooth jawline, small slightly pointed chin, no hard cheekbone line;
large rounded almond eyes with the outer corners drooping downward, a thick dark upper lash line
that widens into a short wing, a thin lower lash line with individually drawn lower lashes and a
soft puffy under-eye pad; pale lavender-violet irises with a dark rim, a light crescent along the
bottom and one bright white specular at the upper left; thin nearly straight dark eyebrows set low
with the inner ends angled down; a nose shown only as a short shadow and a tip highlight;
small glossy lips with a pronounced cupid's bow, a wet highlight and a sliver of upper teeth;
a dense pink blush band across both cheeks and the bridge of the nose with fine diagonal hatching.

HAIR LOCK: straight jet-black hair with a cool grey-violet sheen in the highlights only, no silver,
no grey strands; thick blunt fringe cut just above the eyebrows, split into pointed strand clumps
with a centre part; two long side locks falling in front of the ears and shoulders past the chest;
a few loose wisps at the silhouette edge.

BODY LOCK: head-to-body ratio about one to five and a half, short torso, narrow gently sloping
shoulders with visible collarbones, full bust, narrow waist, wide soft hips, full soft thighs and
calves, soft non-athletic plasticity, pink blush on the knees, black nail polish on fingers and
toes, warm peach porcelain skin with a pink undertone and cold pink-violet shadows, never grey,
never near-white.

CAMERA LOCK: front-facing eye-level view, full seated figure, black office chair,
whole figure inside the frame with both shoes and the chair base visible, no cropped limbs,
vertical 2:3 composition.

COSTUME: <единственное, что меняется>
POSE: <единственное, что меняется>
BACKGROUND: flat vibrant green chroma key — no translucent or mesh surfaces against the key.
```

---

## Правила применения

1. Костюм и поза описываются **после** лока, никогда не вместо него.
2. Если генератор съехал по лицу — не переписывать лок, а делать `face-lock` пасс:
   перенос головы с `heroine_t1_s0.webp` на новый корпус + пересвет.
3. Готовый кадр проходит `scripts/key_plate.py` и гейт `readWebpDims`
   (`1024×1526`, `VP8X`, `alpha: true`).
4. Спорный кадр не «дотягивается» промптом больше двух раз — дальше только face-lock.

---

## Принятая база (baseline)

- **Лицо принято:** плашка `deliverables/concept/miya_from_day1_v5.png` — заказчик подтвердил
  лицо как нужное. Кроп головы сохранён в `deliverables/concept/canon_baseline_face.png`.
- Референс на каждый вызов: `canon_ref_sheet.png` + `canon_baseline_face.png`.
- Всё, что генерируется дальше, обязано совпадать с этой базой по лицу; отличие допускается
  только в костюме, позе и фоне.
