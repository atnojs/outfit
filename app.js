document.addEventListener('DOMContentLoaded', () => {
    // ==== State ====
    const STORAGE_KEY = 'outfit_app_history';
    let originalImageBase64 = null;
    let generatedImageBase64 = null;
    let history = [];

    // Load history from localStorage
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            history = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Error loading history:', e);
    }
    let isLoading = false;
    let activeCategory = null;

    // State para regeneración
    let imageToRegenerate = null;
    let regenModal = null;
    let lightboxModal = null;
    let globalLoader = null;

    // ==== Elements ====
    const dragArea = document.getElementById('drag-area');
    const fileInput = document.getElementById('file-input');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    const uploadedImagePreview = document.getElementById('uploaded-image-preview');

    const categoryContainer = document.getElementById('category-container');
    const subcategoryContainer = document.getElementById('subcategory-container');

    const customPromptInput = document.getElementById('custom-prompt');
    const ideaGeneratorBtn = document.getElementById('idea-generator-btn');
    const ideaGeneratorIcon = document.getElementById('idea-generator-icon');
    const ideaGeneratorSpinner = document.getElementById('idea-generator-spinner');

    const enhancePromptBtn = document.getElementById('enhance-prompt-btn');
    const enhancePromptIcon = document.getElementById('enhance-prompt-icon');
    const enhancePromptSpinner = document.getElementById('enhance-prompt-spinner');

    const intensitySlider = document.getElementById('intensity-slider');
    const intensityValue = document.getElementById('intensity-value');

    const keepColorsCheckbox = document.getElementById('keep-colors-checkbox');
    const changeBackgroundCheckbox = document.getElementById('change-background-checkbox');
    const changePoseCheckbox = document.getElementById('change-pose-checkbox');

    const generateBtn = document.getElementById('generate-btn');
    const generateBtnText = document.getElementById('generate-btn-text');
    const loader = document.getElementById('loader');

    const comparisonContainer = document.getElementById('comparison-container');
    const imageBefore = document.getElementById('image-before');
    const imageAfter = document.getElementById('image-after');

    const downloadBtn = document.getElementById('download-btn');
    const historySection = document.getElementById('history-section');
    const historyContainer = document.getElementById('history-container');

    const styleDescriptionSection = document.getElementById('style-description-section');
    const describeStyleBtn = document.getElementById('describe-style-btn');
    const describeBtnText = document.getElementById('describe-btn-text');
    const describeLoader = document.getElementById('describe-loader');
    const styleDescriptionOutput = document.getElementById('style-description-output');

    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // ==== INYECCIONES DOM ====

    // 1. LOADER GLOBAL
    const injectGlobalLoader = () => {
        if (document.getElementById('global-loader')) return;
        const div = document.createElement('div');
        div.id = 'global-loader';
        div.className = 'global-loader';
        div.innerHTML = `
    <div class="spinner-triple">
        <div class="ring ring-1"></div>
        <div class="ring ring-2"></div>
        <div class="ring ring-3"></div>
    </div>
    <div class="loader-text" id="global-loader-text">Procesando...</div>
    `;
        document.body.appendChild(div);
        globalLoader = div;
    };

    const showGlobalLoader = (text) => {
        const txt = document.getElementById('global-loader-text');
        if (txt) txt.textContent = text;
        if (globalLoader) globalLoader.classList.add('show');
    };

    const hideGlobalLoader = () => {
        if (globalLoader) globalLoader.classList.remove('show');
    };

    // 2. Botón Descargar Todo
    let downloadAllBtn = null;
    const injectDownloadAllButton = () => {
        if (downloadAllBtn) return;
        const header = historySection.querySelector('h2');
        if (!header) return;
        const container = document.createElement('div');
        container.className = 'flex justify-between items-center mb-4';
        header.parentNode.insertBefore(container, header);
        container.appendChild(header);

        downloadAllBtn = document.createElement('button');
        downloadAllBtn.className = 'text-sm text-accent hover:text-white underline transition-colors cursor-pointer';
        downloadAllBtn.textContent = 'Descargar todo (.zip)';
        container.appendChild(downloadAllBtn);
        downloadAllBtn.addEventListener('click', handleDownloadAll);
    };

    // 3. Lightbox
    const injectLightbox = () => {
        if (document.getElementById('lightbox-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'lightbox-overlay';
        overlay.className = 'lightbox-overlay';
        overlay.innerHTML = `<button class="lightbox-close">&times;</button><img src="" class="lightbox-content" id="lightbox-img">`;
        document.body.appendChild(overlay);

        overlay.querySelector('.lightbox-close').onclick = () => overlay.classList.remove('show');
        overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.remove('show'); };
        lightboxModal = overlay;
    };

    const openLightbox = (src) => {
        document.getElementById('lightbox-img').src = src;
        lightboxModal.classList.add('show');
    };

    // 4. Modal Regenerar/Fondo
    const injectRegenModal = () => {
        if (document.getElementById('regen-modal-backdrop')) return;
        const backdrop = document.createElement('div');
        backdrop.id = 'regen-modal-backdrop';
        backdrop.className = 'regen-modal-backdrop';

        backdrop.innerHTML = `
    <div class="regen-modal-content">
    <h3 class="text-2xl font-bold text-white mb-2" id="regen-title">✨ Edición</h3>
    <p class="text-sm text-gray-400 mb-4" id="regen-subtitle">Instrucción</p>
    <textarea id="regen-textarea" class="regen-textarea"></textarea>
    <div class="flex justify-end gap-4">
    <button id="regen-cancel-btn" class="px-6 py-3 rounded-xl border border-gray-600 text-white hover:bg-white/10 transition-colors">Cancelar</button>
    <button id="regen-confirm-btn" class="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg transition-all">Generar</button>
    </div>
    </div>
    `;
        document.body.appendChild(backdrop);

        document.getElementById('regen-cancel-btn').onclick = closeRegenModal;
        document.getElementById('regen-confirm-btn').onclick = handleRegenConfirm;
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeRegenModal(); });
        regenModal = backdrop;
    };

    const openRegenModal = (imgBase64, mode) => {
        imageToRegenerate = imgBase64;
        const title = document.getElementById('regen-title');
        const sub = document.getElementById('regen-subtitle');
        const area = document.getElementById('regen-textarea');

        area.dataset.mode = mode;
        area.value = '';

        if (mode === 'bg') {
            title.textContent = "Cambiar Fondo";
            sub.textContent = "Describe el nuevo lugar. El outfit se mantendrá igual.";
            area.placeholder = "Ej: En una playa tropical al atardecer...";
        } else {
            title.textContent = "Edición Avanzada";
            sub.textContent = "Describe qué detalle quieres cambiar.";
            area.placeholder = "Ej: Ponle gafas de sol, cambia la corbata a roja...";
        }

        regenModal.classList.add('show');
    };

    const closeRegenModal = () => {
        if (regenModal) regenModal.classList.remove('show');
        imageToRegenerate = null;
    };

    const handleRegenConfirm = async () => {
        const textarea = document.getElementById('regen-textarea');
        const prompt = textarea.value.trim();
        if (!prompt) {
            showToast("Escribe una instrucción.");
            return;
        }

        const mode = textarea.dataset.mode;

        // IMPORTANTE: guardar la imagen ANTES de cerrar el modal
        const baseImage = imageToRegenerate;
        if (!baseImage) {
            showToast("No se ha encontrado la imagen a editar. Vuelve a abrir el menú desde el historial.");
            return;
        }

        // Cerrar modal y mostrar loader
        closeRegenModal();
        showGlobalLoader(mode === 'bg' ? "Generando Fondo" : "Editando Imagen");

        try {
            let finalPrompt = "";
            if (mode === 'bg') {
                finalPrompt = `Change ONLY the background to: ${prompt}. Keep the person and outfit exactly as is. High quality photorealism.`;
            } else {
                finalPrompt = `Edit this image based on: ${prompt}. Maintain photorealism.`;
            }

            // Usamos la copia local baseImage (ya no es null)
            const resultBase64 = await callImageAPI(baseImage, finalPrompt);

            generatedImageBase64 = resultBase64;
            imageAfter.src = generatedImageBase64;

            // Si no había original (caso raro), usar la imagen base
            if (!originalImageBase64) {
                originalImageBase64 = baseImage;
            }

            const label = mode === 'bg' ? 'Fondo Nuevo' : 'Editado';
            addToHistory(
                generatedImageBase64,
                { style: label, subcategory: 'Personalizado' },
                finalPrompt
            );
            resetComparisonSlider();

            showToast("¡Imagen actualizada!");
        } catch (e) {
            console.error(e);
            showToast("Error al procesar: " + e.message);
        } finally {
            hideGlobalLoader();
        }
    };

    // ==== Categorías COMPLETAS ====
    const categories = [
        {
            name: 'Formal', icon: '👔', prompt: "Replace the model's outfit with an ultra-realistic formal ensemble featuring premium fabrics, precise tailoring, soft cinematic lighting, and subtle reflections enhancing every texture for a high-end editorial look.", subcategories: [
                { name: 'Traje de Gala', prompt: "Replace the model's outfit with an elegant evening gown made of flowing silk and delicate lace details, illuminated by soft studio lighting that enhances fabric depth, sheen, and realistic skin-light interaction." },
                { name: 'Esmoquin', prompt: "Replace the model's outfit with a classic black tuxedo crafted from fine wool with satin lapels, crisp white shirt, and polished bow tie, under warm cinematic lighting revealing smooth textures and subtle reflections." },
                { name: 'Traje Negocios', prompt: "Replace the model's outfit with a professional business suit featuring sharp lines, structured shoulders, and matte-finish wool fabric under balanced soft lighting highlighting every seam and texture with photoreal precision." },
                { name: 'Vestido Cóctel', prompt: "Replace the model's outfit with a chic cocktail dress in luxurious velvet or silk, emphasizing realistic draping, soft highlights, and lifelike reflections that convey a cinematic sense of sophistication." },
                { name: 'Frac', prompt: "Replace the model's outfit with a traditional full evening dress (white tie) including a black tailcoat, white waistcoat, and bow tie, under crisp cinematic lighting that highlights the sharp contrast, fine fabric weave, and structural precision." },
                { name: 'Chaqué', prompt: "Replace the model's outfit with a classic morning suit featuring a grey or black morning coat, striped trousers, and waistcoat, illuminated by soft daylight emphasizing the fine wool textures and sophisticated layering for a photorealistic formal day event look." },
                { name: 'Vestido de Baile', prompt: "Replace the model's outfit with an opulent ball gown featuring a voluminous skirt of layered tulle or satin, intricate beading, and a structured bodice, under dramatic studio lighting that creates deep shadows and sparkling highlights, enhancing its majestic realism." },
                { name: 'Traje de Lino', prompt: "Replace the model's outfit with an elegant linen suit in a light color, showcasing the fabric's natural weave and characteristic light creasing, under warm, soft outdoor lighting that emphasizes its breathable texture and relaxed, sophisticated realism." },
                { name: 'Mono de Noche', prompt: "Replace the model's outfit with a high-fashion evening jumpsuit made of crepe or silk, featuring a wide-leg silhouette and tailored bodice, illuminated by soft cinematic light that gracefully follows the contours and highlights the material's fluid drape and subtle sheen." }
            ]
        },
        {
            name: 'Casual', icon: '👕', prompt: "Replace the model's outfit with a casual modern look featuring breathable fabrics, natural folds, soft daylight illumination, and balanced contrast for an authentic lifestyle appearance.", subcategories: [
                { name: 'Urbano', prompt: "Replace the model's outfit with a stylish urban streetwear set of layered cotton, denim, and nylon textures, illuminated by natural soft light to reveal fine stitching and tactile material realism." },
                { name: 'Bohemio', prompt: "Replace the model's outfit with a bohemian-inspired combination of loose fabrics, woven patterns, and subtle earthy tones, portrayed under diffused light to emphasize natural drape and fiber detail." },
                { name: 'Vaquero', prompt: "Replace the model's outfit with a timeless denim jeans and t-shirt combination, capturing fabric creases, natural wear, and matte lighting that evokes tactile authenticity and relaxed realism." },
                { name: 'Playero', prompt: "Replace the model's outfit with a relaxed beachwear ensemble of light linen and cotton, rendered with bright but soft lighting to enhance airy textures and realistic cloth translucency." },
                { name: 'Preppy', prompt: "Replace the model's outfit with a preppy ensemble featuring a crisp polo shirt or oxford, chino shorts, and a cable-knit sweater, under bright, clear lighting that highlights the clean lines and rich cotton textures." },
                { name: 'Loungewear', prompt: "Replace the model's outfit with a comfortable loungewear set made of ultra-soft fleece or modal cotton, emphasizing relaxed fit and fabric softness, under warm, diffused indoor lighting that creates a cozy, tactile, and realistic appearance." },
                { name: 'Athleisure', prompt: "Replace the model's outfit with a modern athleisure look, combining technical fabric leggings or joggers with a stylish hoodie, under neutral studio light that accentuates the mix of matte and sheen textures and sporty seams." },
                { name: 'Minimalista', prompt: "Replace the model's outfit with a minimalist casual look using monochrome colors, clean silhouettes, and high-quality basic fabrics like heavy cotton, under soft, even lighting that emphasizes form, simplicity, and subtle texture realism." },
                { name: 'Veraniego', prompt: "Replace the model's outfit with a light summer dress or shorts and a linen shirt, rendered with bright, natural sunlight that casts soft shadows, highlighting the airy fabric, vibrant colors, and relaxed, photorealistic seasonal feel." }
            ]
        },
        {
            name: 'Deportivo', icon: '🏃', prompt: "Replace the model's outfit with ultra-detailed sportswear emphasizing elasticity, breathable mesh textures, and dynamic lighting to convey motion, tension, and lifelike athletic realism.", subcategories: [
                { name: 'Gimnasio', prompt: "Replace the model's outfit with sleek gym wear of stretchable fabric showing muscular definition and tension, rendered with directional lighting enhancing sheen, depth, and micro-texture realism." },
                { name: 'Running', prompt: "Replace the model's outfit with modern running gear made of technical fabrics, moisture-wicking mesh, and reflective strips illuminated with cinematic rim light enhancing contours and material contrast." },
                { name: 'Yoga', prompt: "Replace the model's outfit with soft, form-fitting yoga attire made of smooth breathable fabric, rendered with warm balanced lighting to highlight comfort, subtle sheen, and surface texture." },
                { name: 'Tenis', prompt: "Replace the model's outfit with a refined tennis outfit including polo and skirt or shorts, featuring crisp cotton texture under bright diffused lighting revealing clean, photorealistic surface details." },
                { name: 'Baloncesto', prompt: "Replace the model's outfit with a basketball uniform, including a loose-fitting mesh jersey and shorts, showcasing fabric perforations and sweat-wicking texture under bright arena lighting that highlights material sheen and dynamic folds." },
                { name: 'Fútbol', prompt: "Replace the model's outfit with a professional soccer kit, featuring a lightweight technical jersey and shorts, rendered with dynamic lighting that emphasizes fabric tension over muscles and the realistic texture of the team crest." },
                { name: 'Ciclismo', prompt: "Replace the model's outfit with a form-fitting cycling kit (maillot and bib shorts) made of aerodynamic lycra, under bright outdoor sunlight that reveals the high-contrast graphics, seam details, and fabric's elastic sheen." },
                { name: 'Natación', prompt: "Replace the model's outfit with a competitive swimsuit made of sleek, water-repellent fabric, rendered with sharp lighting that accentuates the body's contours and the material's smooth, skin-tight texture and subtle reflections." },
                { name: 'Esquí', prompt: "Replace the model's outfit with a modern ski suit, including an insulated waterproof jacket and pants, under bright, cold lighting that highlights the nylon texture, protective padding, and realistic snow reflections." }
            ]
        },
        {
            name: 'Disfraz', icon: '🎭', prompt: "Replace the model's outfit with a high-fidelity costume design featuring layered textures, fabric contrast, and cinematic illumination that enhances realism while preserving facial and body proportions of the model.", subcategories: [
                { name: 'Pirata', prompt: "Replace the model's outfit with a richly detailed pirate costume including leather vest, cotton shirt, and weathered fabric accents, rendered with soft directional lighting emphasizing texture, depth, and authentic material wear." },
                { name: 'Personaje Sci-Fi', prompt: "Replace the model's outfit with a futuristic science-fiction costume made of metallic fabrics, tech patterns, and synthetic reflections, rendered under cold cinematic lighting to enhance realism and precision." },
                { name: 'Payaso', prompt: "Replace the model's outfit with a photorealistic clown costume featuring layered satin, ruffles, and vibrant color gradients, captured with balanced lighting to preserve authentic material gloss and soft shadow detail." },
                { name: 'Vampiro', prompt: "Replace the model's outfit with an aristocratic vampire costume, featuring a high-collar velvet cape, satin vest, and lace jabot, under dramatic, low-key cinematic lighting that emphasizes the deep shadows and rich, dark textures." },
                { name: 'Zombie', prompt: "Replace the model's outfit with a distressed zombie costume, showcasing torn, dirt-stained fabrics with realistic weathering, under a grim, cool-toned light that highlights the grime and tattered material." },
                { name: 'Detective Noir', prompt: "Replace the model's outfit with a classic film noir detective costume, including a trench coat with a defined collar and fedora, under harsh, high-contrast lighting that creates sharp shadows and emphasizes the heavy wool texture." },
                { name: 'Vaquero', prompt: "Replace the model's outfit with an authentic cowboy costume, featuring a leather vest, denim, plaid shirt, and weathered hat, illuminated by warm, dusty sunlight that highlights the rugged textures of leather, felt, and cotton." },
                { name: 'Princesa de Cuento', prompt: "Replace the model's outfit with a classic fairy tale princess gown, made of sparkling fabric, layered tulle, and delicate embroidery, under magical, soft-focus lighting that enhances the shimmer, volume, and ethereal realism." }
            ]
        },
        {
            name: 'Cultural', icon: '👘', prompt: "Replace the model's outfit with traditional cultural attire crafted with authentic textiles, detailed stitching, and realistic illumination emphasizing fabric density, embroidery texture, and natural color richness.", subcategories: [
                { name: 'Kimono', prompt: "Replace the model's outfit with a traditional Japanese kimono showcasing fine silk patterns, embroidered motifs, and precise layering, under warm soft lighting enhancing folds, reflections, and material depth." },
                { name: 'Sari', prompt: "Replace the model's outfit with a traditional Indian sari made of lustrous fabric and intricate embroidery, rendered with cinematic lighting that highlights folds, golden accents, and realistic cloth sheen." },
                { name: 'Escocés', prompt: "Replace the model's outfit with a Scottish kilt ensemble featuring wool texture and tartan pattern realism, under soft daylight tones emphasizing natural fiber texture and realistic shadowing." },
                { name: 'Egipcio', prompt: "Replace the model's outfit with an ancient Egyptian-inspired attire made of fine linen, gold-toned accessories, and layered fabrics illuminated with warm cinematic lighting to accentuate surface realism and subtle shine." },
                { name: 'Romano', prompt: "Replace the model's outfit with a Roman-era toga or armor set, displaying detailed fabric drape and metallic reflections under directional lighting revealing craftsmanship, realism, and tactile material contrast." },
                { name: 'Mariachi', prompt: "Replace the model's outfit with a traditional Mariachi 'traje de charro', featuring intricate 'botonadura' (silver buttons) and embroidery on fine wool, under crisp studio lighting that highlights the metallic reflections and deep fabric texture." },
                { name: 'Hanfu', prompt: "Replace the model's outfit with a traditional Chinese Hanfu, characterized by flowing, wide sleeves and layered robes of silk or brocade, under soft, diffused lighting that beautifully captures the garment's graceful drape and intricate patterns." },
                { name: 'Bávaro', prompt: "Replace the model's outfit with traditional Bavarian attire (Lederhosen or Dirndl), showcasing detailed embroidery, leather textures, and crisp linen, under warm, festive lighting that enhances the handcrafted, authentic material realism." },
                { name: 'Dashiki', prompt: "Replace the model's outfit with a vibrant West African Dashiki, known for its colorful embroidery around the neckline, made of rich cotton, under bright, natural light that makes the colors pop and highlights the threadwork." },
                { name: 'Flamenca', prompt: "Replace the model's outfit with a Spanish 'traje de flamenca', featuring a form-fitting body and voluminous 'volantes' (ruffles) in polka-dot fabric, under dramatic, warm lighting that emphasizes the costume's dynamic shape and textile layers." }
            ]
        },
        {
            name: 'Profesional', icon: '💼', prompt: "Replace the model's outfit with a professional uniform rendered with true-to-life materials, stitching accuracy, and soft cinematic lighting emphasizing cleanliness, detail, and functional design realism.", subcategories: [
                { name: 'Médico', prompt: "Replace the model's outfit with a doctor's uniform including a clean white coat, realistic fabric folds, and subtle reflections, illuminated softly to convey professionalism and authentic texture balance." },
                { name: 'Chef', prompt: "Replace the model's outfit with a chef uniform featuring crisp cotton, structured buttons, and a hat, rendered under soft neutral lighting emphasizing tactile realism and fabric depth." },
                { name: 'Piloto', prompt: "Replace the model's outfit with an airline pilot uniform made of pressed dark fabric with metallic accents, illuminated by cinematic rim lighting enhancing detail, sheen, and texture fidelity." },
                { name: 'Bombero', prompt: "Replace the model's outfit with a firefighter uniform showing matte protective textures and reflective strips, under dynamic lighting enhancing the tactile realism and light absorption of the fabric." },
                { name: 'Astronauta', prompt: "Replace the model's outfit with a modern astronaut spacesuit featuring technical material layers, subtle reflections, and high dynamic lighting enhancing the realism of the composite and contours." },
                { name: 'Científico', prompt: "Replace the model's outfit with a realistic scientist lab coat and inner garments rendered with smooth cotton texture and cinematic soft light emphasizing cleanliness and micro-texture fidelity." },
                { name: 'Juez', prompt: "Replace the model's outfit with a judge's robe made of heavy black fabric, featuring voluminous sleeves and a formal collar, under solemn, directional lighting that emphasizes the deep folds and authoritative, matte texture." },
                { name: 'Militar', prompt: "Replace the model's outfit with a modern military combat uniform, featuring a digital camouflage pattern on durable ripstop fabric and a tactical vest, under neutral, clear lighting that reveals the complex textures and functional realism." },
                { name: 'Policía', prompt: "Replace the model's outfit with a police officer uniform, including a dark, crisp-pressed shirt, utility belt with gear, and badge, rendered with clean, direct lighting that highlights the badge's metallic sheen and the fabric's durable weave." },
                { name: 'Mecánico', prompt: "Replace the model's outfit with a mechanic's jumpsuit (coveralls), made of heavy-duty cotton, realistically stained with grease, under bright workshop lighting that highlights the worn texture and fabric's tactile quality." },
                { name: 'Buzo', prompt: "Replace the model's outfit with a full scuba diver suit, including a neoprene wetsuit, mask, and BCD vest, rendered with lighting that simulates underwater caustics, highlighting the suit's texture and gear's reflective surfaces." }
            ]
        },
        {
            name: 'Época', icon: '🕰️', prompt: "Replace the model's outfit with a historically accurate period costume featuring authentic fabrics, realistic tailoring, and balanced cinematic lighting to enhance texture depth and timeless visual richness.", subcategories: [
                { name: 'Medieval', prompt: "Replace the model's outfit with a medieval-style ensemble of layered leather and linen, detailed seams, and subtle metallic accents illuminated with warm directional light for handcrafted realism." },
                { name: 'Años 20', prompt: "Replace the model's outfit with a 1920s flapper dress or tailored suit featuring fine beading or pinstripes, under soft art-deco lighting highlighting textures and period-correct materials." },
                { name: 'Años 50', prompt: "Replace the model's outfit with a 1950s rockabilly look including polished leather, cotton fabrics, and defined silhouettes, illuminated with nostalgic soft light enhancing shape and textile realism." },
                { name: 'Años 70', prompt: "Replace the model's outfit with a 1970s disco-inspired attire showcasing glossy synthetic fabrics and metallic accents, under vibrant cinematic lighting emphasizing texture and realistic sheen." },
                { name: 'Años 80', prompt: "Replace the model's outfit with a bold 1980s fashion style including bright fabrics, layered textures, and reflective surfaces, rendered under soft colored lighting enhancing realism and fabric complexity." },
                { name: 'Años 90', prompt: "Replace the model's outfit with a 1990s grunge-inspired ensemble made of worn denim, flannel, and cotton layers, captured under diffused neutral lighting to enhance tactile realism and depth." },
                { name: 'Futurista', prompt: "Replace the model's outfit with a futuristic sci-fi costume of synthetic metallic fabrics and ergonomic lines, rendered with precise directional lighting emphasizing high-tech realism and clean material definition." },
                { name: 'Victoriano', prompt: "Replace the model's outfit with an elaborate Victorian-era costume, such as a bustle dress with corset, featuring rich velvet, lace, and brocade, under soft, gaslight-style lighting that enhances the luxurious textures and complex layers." },
                { name: 'Regencia', prompt: "Replace the model's outfit with a Regency-era ensemble, like an empire-waist muslin dress or a tailcoat with cravat, under soft, natural window light that emphasizes the delicate fabrics and elegant, clean silhouettes." },
                { name: 'Años 60', prompt: "Replace the model's outfit with a 1960s 'Swinging London' look, featuring a bold geometric print mini-dress or a mod suit, under bright, high-contrast studio lighting that highlights the pop-art colors and synthetic fabric textures." },
                { name: 'Antigua Grecia', prompt: "Replace the model's outfit with an Ancient Greek chiton or peplos, made of flowing, draped linen, secured with fibulae, under warm Mediterranean sunlight that beautifully defines the cascading folds and natural fabric." },
                { name: 'Renacimiento', prompt: "Replace the model's outfit with an opulent Renaissance costume, featuring slashed sleeves, heavy brocade, and velvet doublets or gowns, under a rich, painterly light that highlights the intricate details and fabric's immense depth." }
            ]
        },
        {
            name: 'Superhéroe', icon: '🦸', prompt: "Replace the model's outfit with an ultra-detailed superhero costume rendered with lifelike materials, complex lighting, and physical accuracy, preserving anatomy, contours, and texture realism of the model.", subcategories: [
                { name: 'Superman', prompt: "Replace the model's outfit with a hyperrealistic Superman suit made of stretch fabric and embossed details, illuminated with cinematic highlights enhancing texture depth and authentic color brilliance." },
                { name: 'Batman', prompt: "Replace the model's outfit with a dark, tactical Batman suit made of armored materials and matte surfaces, rendered under low-key lighting emphasizing sculpted realism and surface contrast." },
                { name: 'Iron Man', prompt: "Replace the model's outfit with sleek metallic Iron Man armor featuring realistic reflections, micro-scratches, and balanced highlights to convey polished surface realism and physical believability." },
                { name: 'Spiderman', prompt: "Replace the model's outfit with a detailed Spiderman suit showing fabric mesh pattern, tensioned elasticity, and accurate lighting reflections revealing depth and material fidelity." },
                { name: 'Hulk', prompt: "Replace the model's outfit with torn purple shorts revealing skin-texture realism, under balanced lighting emphasizing surface detail, shadow transition, and lifelike anatomical fidelity." },
                { name: 'Wonder Woman', prompt: "Replace the model's outfit with a Wonder Woman armor made of brushed metal and leather, illuminated with cinematic highlights emphasizing realistic texture depth and handcrafted material contrast." },
                { name: 'Capitán América', prompt: "Replace the model's outfit with a hyperrealistic Captain America suit, emphasizing the scaled armor texture, leather straps, and metallic sheen of the shield, under bright, cinematic lighting that highlights heroism and material definition." },
                { name: 'Black Panther', prompt: "Replace the model's outfit with the intricate Black Panther suit, made of vibranium-weave texture that absorbs and reflects light, under cool, dramatic lighting that emphasizes its sleek, alien technology and sculpted muscular form." },
                { name: 'Thor', prompt: "Replace the model's outfit with Asgardian armor (Thor), featuring chainmail, a flowing red cape, and metallic plates, under dynamic, stormy lighting that highlights the weathered metal, cape's heavy fabric, and divine realism." },
                { name: 'Capitana Marvel', prompt: "Replace the model's outfit with a Captain Marvel suit, capturing the technical fabric, metallic gold accents, and an ethereal glow, under powerful, high-energy lighting that enhances the suit's contours and cosmic power." },
                { name: 'Deadpool', prompt: "Replace the model's outfit with a tactical Deadpool suit, showcasing the detailed red and black fabric weave, leather harnesses, and weathered katanas, under dynamic, action-oriented lighting that highlights the suit's texture and realistic wear." },
                { name: 'Flash', prompt: "Replace the model's outfit with a hyperrealistic Flash suit, made of crimson aerodynamic fabric with ribbed texture and gold metallic accents, rendered with dynamic motion blur and crackling energy lighting that emphasizes speed and material fidelity." },
                { name: 'Aquaman', prompt: "Replace the model's outfit with a photorealistic Aquaman suit, featuring iridescent, scale-like armor in gold and green, and metallic gauntlets, under dramatic underwater lighting (caustics) that highlights the armor's sheen and tactile, waterproof texture." },
                { name: 'Doctor Strange', prompt: "Replace the model's outfit with a Doctor Strange costume, featuring the layered, heavy-weave 'Cloak of Levitation' in red, and blue tunic, under mystical, glowing light from spell sigils that highlights the intricate fabric textures and golden amulet." },
                { name: 'Ant-Man', prompt: "Replace the model's outfit with a detailed Ant-Man suit, capturing the segmented, high-tech design in red and black, with metallic piping and helmet, under clean studio lighting that emphasizes the mix of leather-like textures and polished metal components." },
                { name: 'Vision', prompt: "Replace the model's outfit with the synthetic body of Vision, showcasing the complex musculature, metallic sheen, and flowing yellow cape, under soft, ethereal lighting that highlights the suit's otherworldly texture and the glowing Mind Stone." },
                { name: 'Black Widow', prompt: "Replace the model's outfit with a tactical Black Widow catsuit, made of sleek, form-fitting black synthetic material with utility belts, under cool, low-key lighting that highlights the suit's stealthy texture and realistic material flexing." },
                { name: 'Silver Surfer', prompt: "Replace the model's outfit with the iconic Silver Surfer's liquid-metal skin, rendered with extreme, high-key cosmic lighting that emphasizes the flawless, mirror-like chrome reflections and smooth, anatomical contours." },
                { name: 'Luke Cage', prompt: "Replace the model's outfit with Luke Cage's signature look, featuring a torn yellow t-shirt and denim jeans, showcasing bullet holes on the fabric, under gritty urban lighting that highlights the contrast between the soft cotton and his invulnerable skin." },
                { name: 'Storm', prompt: "Replace the model's outfit with Storm's costume, a sleek white or black ensemble with a flowing cape, under dynamic, stormy lighting with lightning flashes that illuminate the suit's texture and the model's glowing eyes with photorealistic intensity." },
                { name: 'Cyclops', prompt: "Replace the model's outfit with a Cyclops suit, a dark blue tactical X-Men uniform made of durable fabric with yellow accents and a high-tech ruby-quartz visor, under neutral lighting that highlights the visor's metallic sheen and the suit's practical texture." },
                { name: 'Professor X', prompt: "Replace the model's outfit with Professor X's classic look, a sharp, professional business suit (e.g., in fine wool) while seated in his high-tech chrome wheelchair, under soft, intellectual lighting that emphasizes the suit's tailoring and the chair's polished surfaces." },
                { name: 'Supergirl', prompt: "Replace the model's outfit with a hyperrealistic Supergirl suit, featuring the iconic blue stretch fabric and red cape, with an embossed 'S' shield, under bright, optimistic sunlight that highlights the vibrant colors and fine material weave." },
                { name: 'Batgirl', prompt: "Replace the model's outfit with a tactical Batgirl suit, made of dark, armored plates, reinforced fabric, and a utility belt, under moody, low-key Gotham lighting that emphasizes the material contrast between matte fabric and armored sections." },
                { name: 'Catwoman', prompt: "Replace the model's outfit with a sleek Catwoman catsuit, made of glossy black leather or PVC, with a cowl and goggles, rendered under high-contrast lighting that creates sharp reflections and emphasizes the suit's tight, second-skin realism." },
                { name: 'Ghost Rider', prompt: "Replace the model's outfit with a Ghost Rider ensemble, featuring a weathered leather biker jacket, chains, and denim, with the head replaced by a photorealistic flaming skull, under dark, fiery lighting that casts dramatic shadows." },
                { name: 'She-Hulk', prompt: "Replace the model's outfit with a torn professional blouse and skirt (She-Hulk), revealing realistic green skin muscle definition, under bright, balanced lighting that highlights the fabric distress and realistic skin-tone transition." }
            ]
        },
        {
            name: 'Fantasía', icon: '🧙', prompt: "Replace the model's outfit with a fantasy-inspired costume featuring layered materials, magical luminosity, and soft cinematic lighting emphasizing ethereal realism and handcrafted textile detail.", subcategories: [
                { name: 'Elfo', prompt: "Replace the model's outfit with an elegant elven attire composed of silk, velvet, and metallic ornaments, rendered with luminous soft light revealing fine textures and smooth tonal gradients." },
                { name: 'Vikingo', prompt: "Replace the model's outfit with a rugged Viking outfit made of fur, leather, and metal, captured under warm cinematic lighting highlighting tactile realism and authentic material wear." },
                { name: 'Hada', prompt: "Replace the model's outfit with a fairy costume featuring translucent fabrics, glowing wings, and iridescent accents, illuminated with soft diffused light enhancing ethereal realism and fabric shimmer." },
                { name: 'Mago', prompt: "Replace the model's outfit with a wizard robe crafted from heavy woven fabric and detailed accessories, rendered with balanced cinematic lighting emphasizing texture realism and depth." },
                { name: 'Enano', prompt: "Replace the model's outfit with rugged dwarven armor, featuring heavy steel plates, intricate gold inlays, and thick fur lining, under a hard, forge-like light that emphasizes the hammered metal textures and solid, geometric realism." },
                { name: 'Orco', prompt: "Replace the model's outfit with a brutal orcish armor set, composed of salvaged metal plates, raw leather straps, and bone trophies, under harsh, gritty lighting that highlights the crude craftsmanship and battle-worn surfaces." },
                { name: 'Caballero', prompt: "Replace the model's outfit with a full suit of polished plate armor, complete with a helmet and chainmail, under bright directional light that creates brilliant highlights, deep shadows, and shows every scratch and reflection with photoreal precision." },
                { name: 'Sacerdotisa', prompt: "Replace the model's outfit with the flowing robes of a fantasy priestess, made of layered white and gold silk, with mystical sigils, under a soft, divine light that gives the garment an ethereal glow and realistic drape." },
                { name: 'Ladrón', prompt: "Replace the model's outfit with a stealthy rogue's attire, featuring dark, form-fitting leather armor, a hooded cloak, and multiple belts, under low-key, shadowy lighting that emphasizes the material's texture and silhouette." }
            ]
        },
        {
            name: 'Alternativo', icon: '🤘', prompt: "Replace the model's outfit with an alternative subculture-inspired look featuring layered materials, striking contrasts, and realistic lighting enhancing texture accuracy and style authenticity.", subcategories: [
                { name: 'Gótico', prompt: "Replace the model's outfit with a gothic ensemble made of dark velvet, lace, and leather textures illuminated with soft moody light emphasizing depth, realism, and fine textile contrast." },
                { name: 'Punk', prompt: "Replace the model's outfit with a punk rock outfit featuring distressed leather, metal studs, and vivid fabric layers, under cinematic lighting accentuating grit, texture, and realistic reflections." },
                { name: 'Steampunk', prompt: "Replace the model's outfit with a steampunk inventor outfit made of leather, brass, and fabric layers, illuminated by warm cinematic light revealing detailed textures and material authenticity." },
                { name: 'Cyberpunk', prompt: "Replace the model's outfit with a futuristic cyberpunk attire featuring synthetic fabrics, neon accents, and glossy surfaces, rendered under cool directional lighting enhancing realistic reflections and contrast." },
                { name: 'Emo', prompt: "Replace the model's outfit with an 'emo' style look, featuring a tight-fitting band t-shirt, skinny jeans, and a studded belt, under moody, high-contrast lighting that emphasizes the dark colors and layered, personal aesthetic." },
                { name: 'Metalero', prompt: "Replace the model's outfit with a 'metalhead' style, including a distressed black band t-shirt, leather jacket or denim vest with patches, and worn-out jeans, under dramatic, concert-style lighting that highlights the rough textures." },
                { name: 'Skater', prompt: "Replace the model's outfit with a 'skater' look, featuring a loose-fitting graphic hoodie, baggy pants, and skate shoes, under bright, outdoor skate-park lighting that emphasizes the casual fit and cotton/canvas textures." },
                { name: 'Hip-Hop 90s', prompt: "Replace the model's outfit with an 'old school' hip-hop style, including a colorful tracksuit or baggy denim, and oversized chains, under bright, urban lighting that makes the synthetic fabrics and metallic jewelry shine realistically." },
                { name: 'Rave', prompt: "Replace the model's outfit with a 'rave' costume, featuring bright neon colors, fuzzy materials, and futuristic accessories, under UV or strobing light effects that highlight the fluorescent and reflective properties of the materials." }
            ]
        }
    ];

    function composePrePrompt(userPrompt, ctx = {}) {
        // Reforzamos el prompt para evitar bloqueos de seguridad
        return "Generate a high-quality, photorealistic fashion image. The goal is to showcase a specific outfit style. " + (userPrompt || "") + " Ensure the result is safe, artistic, and suitable for a general audience.";
    }

    async function postProcessDataURL(dataURL, opts = {}) {
        const img = await new Promise((res, rej) => {
            const im = new Image(); im.crossOrigin = 'anonymous';
            im.onload = () => res(im); im.onerror = rej; im.src = dataURL;
        });
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        return c.toDataURL('image/png', 0.95);
    }

    // ==== Init ====
    const init = () => {
        renderCategories();
        setupEventListeners();
        injectDownloadAllButton();
        injectRegenModal();
        injectGlobalLoader();
        injectLightbox();
        ensureStyleDescClose();
        setupComparisonSlider();
        if (history.length > 0) renderHistory();
    };

    const renderCategories = () => {
        categoryContainer.innerHTML = '';
        categories.forEach((cat, index) => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.innerHTML = `<span class="text-2xl">${cat.icon}</span><span class="text-xs font-medium">${cat.name}</span>`;
            btn.dataset.index = index;
            btn.addEventListener('click', () => handleCategoryClick(btn, cat));
            categoryContainer.appendChild(btn);
        });
    };

    const renderSubcategories = (subcategories) => {
        subcategoryContainer.innerHTML = '';
        subcategories.forEach(subCat => {
            const btn = document.createElement('button');
            btn.className = 'subcategory-btn';
            btn.textContent = subCat.name;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.subcategory-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                customPromptInput.value = subCat.prompt;
            });
            subcategoryContainer.appendChild(btn);
        });
    };

    const handleCategoryClick = (btn, category) => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = category;
        if (category.subcategories) renderSubcategories(category.subcategories);
    };

    // ==== Events ====
    const setupEventListeners = () => {
        dragArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => dragArea.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); }));
        dragArea.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));

        intensitySlider.addEventListener('input', (e) => {
            intensityValue.textContent = e.target.value;
            e.target.style.setProperty('--val', e.target.value + '%');
        });
        intensitySlider.style.setProperty('--val', intensitySlider.value + '%');

        generateBtn.addEventListener('click', handleGenerateClick);

        ideaGeneratorBtn.addEventListener('click', handleGenerateIdea);
        enhancePromptBtn.addEventListener('click', handleEnhancePrompt);
        describeStyleBtn.addEventListener('click', handleDescribeStyle);
    };

    const showToast = (message) => {
        toastMessage.textContent = message;
        toast.classList.remove('opacity-0', 'translate-y-3');
        setTimeout(() => { toast.classList.add('opacity-0', 'translate-y-3'); }, 3000);
    };

    const handleFile = (file) => {
        if (!file || !file.type.startsWith('image/')) { showToast("Sube una imagen válida."); return; }
        const reader = new FileReader();
        reader.onloadend = () => {
            originalImageBase64 = reader.result;
            uploadedImagePreview.src = originalImageBase64;
            uploadedImagePreview.classList.remove('hidden');
            uploadPlaceholder.classList.add('hidden');
            imageBefore.src = originalImageBase64;
            comparisonContainer.classList.remove('hidden');
            imageAfter.src = 'https://placehold.co/1024x1024/1f2937/d1d5db?text=Genera+un+outfit';
            resetComparisonSlider();
        };
        reader.readAsDataURL(file);
    };

    const setLoading = (state) => {
        isLoading = state;
        generateBtn.disabled = state;

        if (state) {
            generateBtnText.classList.add('hidden');
            loader.classList.remove('hidden');
        } else {
            generateBtnText.classList.remove('hidden');
            loader.classList.add('hidden');
        }
    };

    // ==== Describe style modal close ====
    function ensureStyleDescClose() {
        styleDescriptionOutput.style.position = 'relative';
        if (styleDescriptionOutput.querySelector('.style-desc-close')) return;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'style-desc-close';
        closeBtn.type = 'button';
        closeBtn.ariaLabel = 'Cerrar descripción';
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
            position: 'absolute', top: '8px', right: '8px',
            width: '28px', height: '28px', borderRadius: '9999px',
            background: 'rgba(17,24,39,0.9)', color: '#fff',
            fontWeight: '700', lineHeight: '28px', textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 2px 6px rgba(0,0,0,0.35)', cursor: 'pointer', zIndex: '2'
        });
        closeBtn.addEventListener('click', () => {
            styleDescriptionOutput.classList.add('hidden');
            styleDescriptionOutput.innerHTML = '';
            styleDescriptionOutput.appendChild(closeBtn);
        });
        styleDescriptionOutput.appendChild(closeBtn);
    }

    const handleDescribeStyle = async () => {
        if (!generatedImageBase64) { showToast("Primero genera un outfit."); return; }
        describeBtnText.classList.add('hidden');
        describeLoader.classList.remove('hidden');
        describeStyleBtn.disabled = true;
        styleDescriptionOutput.classList.remove('hidden');
        ensureStyleDescClose();
        const closeBtn = styleDescriptionOutput.querySelector('.style-desc-close');
        styleDescriptionOutput.innerHTML = '<div class="flex items-center justify-center"><div class="spinner" style="width: 24px; height: 24px;"></div><span class="ml-2">Analizando estilo...</span></div>';
        if (closeBtn) styleDescriptionOutput.appendChild(closeBtn);
        try {
            const prompt = "Describe en español, breve y con gancho, el outfit de la imagen. Nombra el estilo.";
            const description = await callMultimodalAPI(prompt, generatedImageBase64);
            styleDescriptionOutput.innerHTML = `<div style="padding-right:40px;">${description}</div>`;
            ensureStyleDescClose();
        } catch (e) {
            styleDescriptionOutput.innerHTML = '<div style="padding-right:40px;">No se pudo generar la descripción del estilo.</div>';
            ensureStyleDescClose();
            console.error(e);
        } finally {
            describeBtnText.classList.remove('hidden');
            describeLoader.classList.add('hidden');
            describeStyleBtn.disabled = false;
        }
    };

    // ==== Generate ====
    const handleGenerateClick = async () => {
        if (!originalImageBase64) { showToast("Primero sube una imagen."); return; }
        if (!activeCategory && !customPromptInput.value) { showToast("Elige un estilo."); return; }

        const prompt = constructPrompt();
        const currentStyle = {
            style: activeCategory ? activeCategory.name : 'Personalizado',
            subcategory: 'Generado'
        };

        try {
            const iterations = 2;
            let lastResult = null;

            for (let i = 0; i < iterations; i++) {
                showGlobalLoader(`Generando imagen ${i + 1} de ${iterations}`);
                try {
                    if (i > 0) await new Promise(r => setTimeout(r, 2000));
                    const resultBase64 = await callImageAPI(originalImageBase64, prompt);
                    lastResult = resultBase64;
                    addToHistory(resultBase64, currentStyle, prompt);
                } catch (innerError) {
                    console.warn(`Generación ${i + 1} falló:`, innerError);
                    // Si falla la primera, intentamos seguir, pero si es la última y no hay resultado, lanzamos error
                    if (i === iterations - 1 && !lastResult) throw innerError;
                }
            }

            if (lastResult) {
                generatedImageBase64 = lastResult;
                imageAfter.src = generatedImageBase64;
                styleDescriptionSection.classList.remove('hidden');
                styleDescriptionOutput.classList.add('hidden');
                resetComparisonSlider();
                showToast(`¡${iterations} outfits generados!`);
            }

        } catch (error) {
            console.error(error);
            showToast("Error: " + (error.message || "No se pudo generar la imagen."));
        } finally {
            hideGlobalLoader();
        }
    };

    const handleGenerateIdea = async () => {
        ideaGeneratorIcon.classList.add('hidden'); ideaGeneratorSpinner.classList.remove('hidden'); ideaGeneratorBtn.disabled = true;
        try {
            const prompt = "Generate a short, creative outfit idea in spanish. No extra text.";
            const idea = await callTextAPI(prompt); customPromptInput.value = idea.replace(/[\"*]/g, '').trim();
        } catch (error) { showToast('Error al generar idea.'); } finally {
            ideaGeneratorIcon.classList.remove('hidden'); ideaGeneratorSpinner.classList.add('hidden'); ideaGeneratorBtn.disabled = false;
        }
    };

    const handleEnhancePrompt = async () => {
        const current = customPromptInput.value.trim();
        if (!current) { showToast("Escribe una idea."); return; }
        enhancePromptIcon.classList.add('hidden'); enhancePromptSpinner.classList.remove('hidden'); enhancePromptBtn.disabled = true;
        try {
            const prompt = `Eres un experto en prompts. Mejora esta idea de outfit en español: '${current}'`;
            const out = await callTextAPI(prompt); customPromptInput.value = out.replace(/["*]/g, '').trim();
        } catch (e) { showToast('Error al mejorar.'); } finally {
            enhancePromptIcon.classList.remove('hidden'); enhancePromptSpinner.classList.add('hidden'); enhancePromptBtn.disabled = false;
        }
    };

    const constructPrompt = () => {
        const parts = ["Change the person's outfit."];
        const customText = customPromptInput.value.trim();
        if (customText) parts.push(`New outfit: ${customText}.`);
        else if (activeCategory) parts.push(`New style: ${activeCategory.prompt}`);

        if (changeBackgroundCheckbox?.checked) parts.push("Change background to a realistic matching environment.");
        if (changePoseCheckbox?.checked) parts.push("Change pose dynamically.");

        return parts.join(' ');
    };

    const setupComparisonSlider = () => {
        const slider = document.getElementById('comparison-slider');
        if (!slider) return;
        let isDragging = false;
        imageAfter.style.clipPath = `polygon(50% 0, 100% 0, 100% 100%, 50% 100%)`;

        const moveSlider = (x) => {
            const rect = comparisonContainer.getBoundingClientRect();
            let pos = (x - rect.left) / rect.width;
            pos = Math.max(0, Math.min(1, pos));
            slider.style.left = `${pos * 100}%`;
            imageAfter.style.clipPath = `polygon(${pos * 100}% 0, 100% 0, 100% 100%, ${pos * 100}% 100%)`;
        };

        comparisonContainer.addEventListener('mousedown', () => isDragging = true);
        window.addEventListener('mouseup', () => isDragging = false);
        comparisonContainer.addEventListener('mousemove', (e) => { if (isDragging) moveSlider(e.clientX); });
        comparisonContainer.addEventListener('touchstart', () => isDragging = true);
        window.addEventListener('touchend', () => isDragging = false);
        comparisonContainer.addEventListener('touchmove', (e) => { if (isDragging) moveSlider(e.touches[0].clientX); });
    };

    const resetComparisonSlider = () => {
        const slider = document.getElementById('comparison-slider');
        if (!slider) return;
        slider.style.left = '50%';
        imageAfter.style.clipPath = 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)';
    };

    const addToHistory = (imageBase64, styleInfo, promptUsed) => {
        // Save original image too so we can restore the pair
        const historyItem = {
            image: imageBase64,
            original: originalImageBase64, // SAVE ORIGINAL
            style: styleInfo,
            prompt: promptUsed,
            date: Date.now()
        };
        history.unshift(historyItem);

        // Persist
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (e) {
            console.warn('History save failed', e);
            if (e.name === 'QuotaExceededError') {
                alert("El historial está lleno. Borra algunas imágenes antiguas para guardar nuevas.");
            }
        }

        renderHistory();
    };

    const renderHistory = () => {
        historySection.classList.remove('hidden');
        historyContainer.innerHTML = '';
        history.forEach((item, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'history-item-wrapper';

            const thumb = document.createElement('img');
            thumb.src = item.image;

            const actions = document.createElement('div');
            actions.className = 'history-item-actions';

            const createBtn = (cls, icon, tooltip, onClick) => {
                const b = document.createElement('button');
                b.className = `btn-square ${cls}`;
                b.innerHTML = `${icon}<span class="btn-tooltip">${tooltip}</span>`;
                b.onclick = (e) => { e.stopPropagation(); onClick(); };
                return b;
            };

            // 1. Descargar
            actions.appendChild(createBtn('btn-sq-green',
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
                'Descargar',
                () => { const a = document.createElement('a'); a.href = item.image; a.download = `outfit_${index}.png`; a.click(); }
            ));

            // 0. ZOOM (Nuevo)
            actions.appendChild(createBtn('btn-sq-white',
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
                'Ver Zoom',
                () => openLightbox(item.image)
            ));

            // 1. Descargar
            actions.appendChild(createBtn('btn-sq-blue',
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
                'Regenerar imagen',
                async () => {
                    showGlobalLoader("Regenerando la Imagen");
                    try {
                        const res = await callImageAPI(originalImageBase64, item.prompt || constructPrompt());
                        addToHistory(res, item.style, item.prompt);
                        generatedImageBase64 = res; imageAfter.src = res;
                    } catch (e) { showToast("Error"); } finally { hideGlobalLoader(); }
                }
            ));

            // 3. Editar
            actions.appendChild(createBtn('btn-sq-purple',
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>',
                'Editar Imagen',
                () => openRegenModal(item.image, 'edit')
            ));

            // 4. Fondo
            actions.appendChild(createBtn('btn-sq-orange',
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-4.5-4.5L9 18"/><path d="M5 16l2-2 3.5 3.5"/></svg>',
                'Cambiar Fondo',
                () => openRegenModal(item.image, 'bg')
            ));

            // 5. Eliminar
            actions.appendChild(createBtn('btn-sq-red',
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
                'Eliminar',
                () => {
                    history.splice(index, 1);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); // Update storage
                    renderHistory();
                }
            ));

            wrapper.onclick = () => restoreFromHistory(item);
            wrapper.append(thumb, actions);
            historyContainer.appendChild(wrapper);
        });
    };

    const restoreFromHistory = (item) => {
        if (!item.original) {
            // Fallback for old history items that might not have 'original'
            showToast("Imagen antigua: solo se puede ver, no editar.");
            openLightbox(item.image);
            return;
        }

        originalImageBase64 = item.original;
        generatedImageBase64 = item.image;

        // UI Update
        uploadedImagePreview.src = originalImageBase64;
        uploadedImagePreview.classList.remove('hidden');
        uploadPlaceholder.classList.add('hidden');

        imageBefore.src = originalImageBase64;
        imageAfter.src = generatedImageBase64;

        comparisonContainer.classList.remove('hidden');
        styleDescriptionSection.classList.remove('hidden');
        styleDescriptionOutput.classList.add('hidden'); // Clear old description

        resetComparisonSlider();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast("Estilo cargado desde historial");
    };

    async function handleDownloadAll() {
        if (!history.length) return;
        await ensureJSZip();
        const zip = new JSZip();
        history.forEach((it, i) => zip.file(`outfit_${i}.png`, it.image.split(',')[1], { base64: true }));
        const c = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(c); a.download = 'outfits.zip'; a.click();
    }

    function ensureJSZip() {
        return new Promise(r => { if (window.JSZip) return r(); const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'; s.onload = r; document.head.appendChild(s); });
    }

    const callApiWithExponentialBackoff = async (url, payload) => {
        let response;
        for (let i = 0; i < 3; i++) {
            try {
                response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (response.ok) return response.json();
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            } catch (e) { if (i === 2) throw e; }
        }
        throw new Error("API Failed");
    };

    const callTextAPI = async (prompt) => {
        const proxyUrl = 'proxy.php';
        // CAMBIO DE MODELO A GEMINI 3 PRO PREVIEW (Si está disponible)
        const targetApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent';
        const finalPrompt = composePrePrompt(prompt, { integration: false });

        const safetySettings = [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ];

        const proxyPayload = {
            targetUrl: targetApiUrl,
            payload: {
                contents: [{ parts: [{ text: finalPrompt }] }],
                safetySettings: safetySettings
            }
        };
        const result = await callApiWithExponentialBackoff(proxyUrl, proxyPayload);
        return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    };

    const callMultimodalAPI = async (prompt, base64Image) => {
        const proxyUrl = 'proxy.php';
        // CAMBIO DE MODELO A GEMINI 3 PRO PREVIEW
        const targetApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent';

        const cleanBase64 = base64Image.split(',')[1];
        const finalPrompt = composePrePrompt(prompt, { integration: false });

        const safetySettings = [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ];

        const payload = {
            contents: [{
                parts: [
                    { text: finalPrompt },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: cleanBase64
                        }
                    }
                ]
            }],
            safetySettings: safetySettings
        };

        const data = await callApiWithExponentialBackoff(proxyUrl, {
            targetUrl: targetApiUrl,
            payload
        });

        const parts =
            (data?.candidates?.[0]?.content?.parts && Array.isArray(data.candidates[0].content.parts))
                ? data.candidates[0].content.parts
                : (Array.isArray(data?.parts) ? data.parts : []);

        const textPart = parts.find(p => p.text);
        return textPart?.text || "";
    };

    const callImageAPI = async (base64Image, prompt) => {
        const proxyUrl = 'proxy.php';
        // CAMBIO DE MODELO A GEMINI 3 PRO PREVIEW
        // NOTA: Si este modelo no soporta imagen, fallará.
        const targetApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent';

        const cleanBase64 = base64Image.split(',')[1];
        const finalPrompt = composePrePrompt(prompt);

        const safetySettings = [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ];

        const payload = {
            contents: [{
                parts: [
                    { text: finalPrompt },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: cleanBase64
                        }
                    }
                ]
            }],
            safetySettings: safetySettings,
            generation_config: {
                candidateCount: 1,
                maxOutputTokens: 2048,
                temperature: 0.7,
                topP: 1,
                topK: 32
            }
        };

        // Llamada vía proxy
        const data = await callApiWithExponentialBackoff(proxyUrl, {
            targetUrl: targetApiUrl,
            payload,
            method: 'POST'
        });

        console.log("Respuesta API:", data);

        // Manejo de respuesta
        const parts = data?.candidates?.[0]?.content?.parts || [];
        let imageData = null;

        // Buscamos la imagen en inlineData (SDK/Camel) o inline_data (REST/Snake)
        for (const p of parts) {
            if (p.inlineData?.data) {
                imageData = p.inlineData.data;
                break;
            }
            if (p.inline_data?.data) {
                imageData = p.inline_data.data;
                break;
            }
        }

        if (!imageData) {
            // Verificamos si fue bloqueado por seguridad
            const finishReason = data?.candidates?.[0]?.finishReason;
            if (finishReason) {
                console.warn("Finish Reason:", finishReason);
                if (finishReason === 'SAFETY' || finishReason === 'IMAGE_OTHER') {
                    throw new Error("La imagen fue bloqueada por filtros de seguridad. Intenta con otra foto o prompt.");
                }
            }

            // Si el modelo no soporta imagen, probablemente devuelva texto o error 400/404
            if (data.error) {
                throw new Error("Error de API: " + data.error.message);
            }

            throw new Error("La API no devolvió imagen. Revisa la consola.");
        }

        return await postProcessDataURL(`data:image/png;base64,${imageData}`);
    };

    init();
});
