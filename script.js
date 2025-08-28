document.addEventListener('DOMContentLoaded', () => {
    // --- ÉLÉMENTS DU DOM (uniquement ceux présents dans le HTML initial) ---
    const fileInput = document.getElementById('fileInput'),
        fileNameSpan = document.getElementById('fileName'),
        resetBtn = document.getElementById('resetBtn'),
        mainToolsContainer = document.getElementById('main-tools'),
        resultContainer = document.getElementById('result'),
        settingsModal = document.getElementById('settingsModal'),
        openSettingsBtn = document.getElementById('openSettingsBtn'),
        partnerListContainer = document.getElementById('partnerListContainer'),
        partnerForm = document.getElementById('partnerForm'),
        partnerFormTitle = document.getElementById('partnerFormTitle'),
        saveSettingsBtn = document.getElementById('saveSettingsBtn'),
        importSettingsBtn = document.getElementById('importSettingsBtn'),
        importSettingsInput = document.getElementById('importSettingsInput'),
        exportSettingsBtn = document.getElementById('exportSettingsBtn'),
        roomOrderList = document.getElementById('roomOrderList'),
        planOrderList = document.getElementById('planOrderList'),
        defaultConfigUrlInput = document.getElementById('defaultConfigUrl'),
        clearDefaultConfigUrlBtn = document.getElementById('clearDefaultConfigUrl');

    // --- DONNÉES GLOBALES ET CONFIGURATION ---
    let hotelData = {};
    let reportInfo = "";
    let lastResultsForExport = null;
    let currentView = 'simulator';
    let appConfig = {};
    const DEFAULT_CONFIG = {
        partners: { "Agoda (6144)": { commission: 14.5, codes: ["OTA-RO-FLEX", "OTA-RO-NANR"] }, "Expedia (1903)": { commission: 18.9, codes: ["OTA-RO-FLEX", "OTA-RO-NANR"] }, "Booking.com (6562)": { commission: null, codes: ["OTA-RO-FLEX", "OTA-RO-NANR"] } },
        displayOrder: { rooms: [], plans: [] }
    };

    // ===================================================================================
    // SECTION 1: FONCTIONS UTILITAIRES ET DE BAS NIVEAU
    // ===================================================================================

    const showToast = (message, type = "success") => {
        const toast = document.createElement("div");
        toast.className = `fixed top-5 right-5 z-[100] px-6 py-3 rounded-lg shadow-xl text-white font-medium flex items-center transition-transform duration-300 transform translate-x-full ${type === 'error' ? 'bg-red-600' : 'bg-indigo-600'}`;
        toast.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'} mr-3"></i> ${message}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.remove("translate-x-full"), 10);
        setTimeout(() => { toast.classList.add("translate-x-full"); toast.addEventListener('transitionend', () => toast.remove()); }, 4000);
    };

    const excelSerialDateToYYYYMMDD = (serial) => {
        if (typeof serial !== 'number' || isNaN(serial)) return null;
        const utc_days = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        return `${date_info.getUTCFullYear()}-${String(date_info.getUTCMonth() + 1).padStart(2, '0')}-${String(date_info.getUTCDate()).padStart(2, '0')}`;
    };

    const formatDateForDisplay = (dateString, options = { weekday: 'short', month: 'long', day: 'numeric' }) => {
        return new Date(dateString + 'T00:00:00Z').toLocaleDateString('fr-FR', options);
    };

    const deepMerge = (target, source) => {
        const output = { ...target };
        if (source && typeof source === 'object' && !Array.isArray(source)) {
            Object.keys(source).forEach(key => {
                if (source[key] instanceof Object && key in output && !Array.isArray(source[key])) {
                    output[key] = deepMerge(output[key], source[key]);
                } else {
                    output[key] = source[key];
                }
            });
        }
        return output;
    };

    const getStockCell = (stock) => {
        if (stock === undefined || stock === null) return { cellClass: 'bg-gray-100 text-gray-400', content: 'N/A' };
        const stockNum = parseInt(stock, 10);
        if (isNaN(stockNum) || stockNum <= 0) return { cellClass: 'bg-red-100 text-red-800', content: '0' };
        if (stockNum <= 3) return { cellClass: 'bg-orange-100 text-orange-800', content: stockNum };
        return { cellClass: 'bg-green-100 text-green-800', content: stockNum };
    };

    // ===================================================================================
    // SECTION 2: MISE À JOUR DE L'INTERFACE (UI)
    // ===================================================================================
    
    const injectHTMLContent = () => {
        mainToolsContainer.innerHTML = `
            <div class="flex border-b border-gray-200 bg-gray-50 rounded-t-xl -mb-px">
                <button id="tab-simulator" class="flex-1 py-4 px-2 text-center font-semibold text-gray-600 border rounded-t-lg border-b-0">
                    <i class="fas fa-calculator mr-2"></i>Simulateur de Réservation
                </button>
                <button id="tab-availability" class="flex-1 py-4 px-2 text-center font-semibold text-gray-600 border rounded-t-lg border-b-0">
                    <i class="fas fa-table mr-2"></i>Vérificateur de Disponibilité
                </button>
            </div>
            <div>
                <div id="panel-simulator" class="p-6 md:p-8 border border-gray-200 border-t-0 rounded-b-xl"></div>
                <div id="panel-availability" class="p-6 md:p-8 border border-gray-200 border-t-0 rounded-b-xl hidden"></div>
            </div>`;

        document.getElementById('panel-simulator').innerHTML = `<form id="simulationForm" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4 items-end">
                <div class="md:col-span-2"><label for="partnerSelect" class="block text-sm font-medium text-gray-700 mb-1">Partenaire</label><select id="partnerSelect" class="block w-full py-2 px-3 border border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></select></div>
                <div><label for="roomSelect" class="block text-sm font-medium text-gray-700 mb-1">Type de chambre</label><select id="roomSelect" class="block w-full py-2 px-3 border border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></select></div>
                <div><label for="planSelect" class="block text-sm font-medium text-gray-700 mb-1">Plan tarifaire</label><select id="planSelect" class="block w-full py-2 px-3 border border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></select></div>
                <div class="md:col-span-2"><label for="simStartDate" class="block text-sm font-medium text-gray-700 mb-1">Date d'arrivée</label><input type="date" id="simStartDate" class="block w-full py-2 px-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></div>
                <div class="md:col-span-2"><label for="simEndDate" class="block text-sm font-medium text-gray-700 mb-1">Date de départ</label><input type="date" id="simEndDate" class="block w-full py-2 px-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></div>
            </div>
            <div class="pt-2"><button type="submit" id="simulateBtn" disabled class="w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">Simuler la Réservation</button></div>
        </form>`;

        document.getElementById('panel-availability').innerHTML = `<form id="availabilityForm" class="space-y-6"><div class="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label for="availStartDate" class="block text-sm font-medium text-gray-700 mb-1">Date de début</label><input type="date" id="availStartDate" class="block w-full py-2 px-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></div><div><label for="availEndDate" class="block text-sm font-medium text-gray-700 mb-1">Date de fin</label><input type="date" id="availEndDate" class="block w-full py-2 px-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></div></div><div><div class="flex justify-between items-center mb-2"><label class="block text-sm font-medium text-gray-700">Types de chambres</label><button type="button" id="selectAllBtn" class="text-sm font-semibold text-indigo-600 hover:underline">Tout sélectionner</button></div><div id="roomTypesContainer" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-gray-50 max-h-48 overflow-y-auto"></div></div><div class="pt-2"><button type="submit" id="availabilityBtn" disabled class="w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">Vérifier les Disponibilités</button></div></form>`;
        
        resultContainer.innerHTML = `
            <div class="p-6 md:p-8">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800" id="resultTitle"></h2>
                        <p id="reportInfoDisplay" class="text-sm text-gray-600 mt-1 font-medium hidden"></p>
                    </div>
                    <button id="exportBtn" class="hidden px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-all flex-shrink-0">
                        <i class="fas fa-file-excel mr-2"></i>Exporter
                    </button>
                </div>
                <div id="loading" class="hidden flex justify-center items-center py-12">
                    <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
                <div id="resultContent" class="table-container"></div>
                <div id="financialSummary" class="hidden mt-6 pt-6 border-t"></div>
            </div>`;

        partnerForm.innerHTML = `
            <input type="hidden" id="originalPartnerName">
            <div>
                <label for="partnerName" class="block text-sm font-medium text-gray-600">Nom du partenaire</label>
                <input type="text" id="partnerName" required class="mt-1 modal-input" placeholder="Ex: Booking.com (1234)">
            </div>
            <div>
                <label for="partnerCommission" class="block text-sm font-medium text-gray-600">Commission (%)</label>
                <input type="number" id="partnerCommission" class="mt-1 modal-input" placeholder="15" min="0" max="100" step="0.1">
            </div>
            <div>
                <label for="partnerCodes" class="block text-sm font-medium text-gray-600">Codes des plans tarifaires (séparés par une virgule)</label>
                <textarea id="partnerCodes" rows="4" class="mt-1 modal-input" placeholder="OTA-FLEX, OTA-NANR, ..."></textarea>
            </div>
            <div class="flex items-center gap-4 pt-2">
                <button type="submit" id="savePartnerBtn" class="btn-primary flex-grow">
                    <i class="fas fa-plus mr-2"></i>Ajouter
                </button>
                <button type="button" id="clearPartnerFormBtn" class="btn-secondary">Annuler</button>
            </div>`;
    };

    const switchTab = (activeKey) => {
        currentView = activeKey;
        document.querySelectorAll('#main-tools .flex button').forEach(btn => btn.classList.remove('tab-active'));
        document.getElementById(`tab-${activeKey}`).classList.add('tab-active');
        document.querySelectorAll('#main-tools > div > div[id^="panel-"]').forEach(panel => panel.classList.add('hidden'));
        document.getElementById(`panel-${activeKey}`).classList.remove('hidden');
        resultContainer.classList.add('hidden');
    };

    const populatePartnerFilter = () => {
        const partnerSelect = document.getElementById('partnerSelect');
        partnerSelect.innerHTML = '<option value="all">Tous les partenaires</option>';
        Object.keys(appConfig.partners).sort().forEach(partner => partnerSelect.add(new Option(partner, partner)));
    };

    const populateSimulatorSelectors = () => {
        const roomSelect = document.getElementById('roomSelect');
        const originalValue = roomSelect.value;
        roomSelect.innerHTML = '<option value="">Choisir une chambre</option>';
        const currentRooms = Object.keys(hotelData);
        (appConfig.displayOrder.rooms || []).filter(room => currentRooms.includes(room)).forEach(roomName => { roomSelect.add(new Option(roomName, roomName)); });
        if (currentRooms.includes(originalValue)) roomSelect.value = originalValue;
        updatePlans();
    };

    const updatePlans = () => {
        const planSelect = document.getElementById('planSelect');
        const selectedRoom = document.getElementById('roomSelect').value;
        const selectedPartner = document.getElementById('partnerSelect').value;
        planSelect.innerHTML = '<option value="">Choisir un plan</option>';
        if (selectedRoom && hotelData[selectedRoom]?.plans) {
            let availablePlansForRoom = Object.keys(hotelData[selectedRoom].plans);
            if (selectedPartner !== "all") {
                const partnerInfo = appConfig.partners[selectedPartner];
                availablePlansForRoom = partnerInfo ? availablePlansForRoom.filter(plan => (partnerInfo.codes || []).some(code => plan.includes(code))) : [];
            }
            const finalSortedPlans = (appConfig.displayOrder.plans || []).filter(plan => availablePlansForRoom.includes(plan));
            finalSortedPlans.forEach(planName => planSelect.add(new Option(planName, planName)));
        }
    };

    const populateAvailabilityCheckboxes = () => {
        const container = document.getElementById('roomTypesContainer');
        container.innerHTML = '';
        const roomTypes = Object.keys(hotelData);
        if (roomTypes.length === 0) {
            container.innerHTML = '<p class="text-gray-500 col-span-full text-center">Chargez un fichier.</p>'; return;
        }
        (appConfig.displayOrder.rooms || []).filter(room => roomTypes.includes(room)).forEach(room => {
            const id = `room_check_${room.replace(/\s/g, '_')}`;
            container.innerHTML += `<label class="flex items-center space-x-2 cursor-pointer p-1 hover:bg-gray-200 rounded-md"><input type="checkbox" id="${id}" value="${room}" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"><span class="text-sm">${room}</span></label>`;
        });
    };

    const updateAllUI = () => {
        populatePartnerFilter();
        populateSimulatorSelectors();
        populateAvailabilityCheckboxes();
    };

    const resetUI = () => {
        document.querySelectorAll('form').forEach(f => f.reset());
        fileInput.value = "";
        fileNameSpan.textContent = "Sélectionner un fichier";
        hotelData = {};
        reportInfo = "";
        resultContainer.classList.add('hidden');
        lastResultsForExport = null;
        updateAllUI();
        document.getElementById('simulateBtn').disabled = true;
        document.getElementById('availabilityBtn').disabled = true;
        showToast("Interface réinitialisée.", "success");
    };
    
    const displayLoading = () => {
        const resultContent = document.getElementById('resultContent');
        const financialSummary = document.getElementById('financialSummary');
        const loadingDiv = document.getElementById('loading');
        const exportBtn = document.getElementById('exportBtn');
        const reportInfoDisplay = document.getElementById('reportInfoDisplay');
        resultContainer.classList.remove('hidden');
        loadingDiv.classList.remove('hidden');
        exportBtn.classList.add('hidden');
        reportInfoDisplay.classList.add('hidden');
        resultContent.innerHTML = '';
        financialSummary.classList.add('hidden');
    };

    const hideLoading = () => {
        const loadingDiv = document.getElementById('loading');
        const exportBtn = document.getElementById('exportBtn');
        const reportInfoDisplay = document.getElementById('reportInfoDisplay');
        loadingDiv.classList.add('hidden');
        exportBtn.classList.remove('hidden');
        if (reportInfo) {
            reportInfoDisplay.innerHTML = `<i class="fas fa-info-circle mr-2 text-blue-500"></i>Source: ${reportInfo}`;
            reportInfoDisplay.classList.remove('hidden');
        }
    };
    
    // ===================================================================================
    // SECTION 3: LOGIQUE MÉTIER ET GESTIONNAIRES D'ÉVÉNEMENTS PRINCIPAUX
    // ===================================================================================

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        fileNameSpan.textContent = file.name;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: null });
                hotelData = {};
                reportInfo = json[0][0] || "Données du rapport";
                const datesHeader = json[0].slice(3).map(d => excelSerialDateToYYYYMMDD(d)).filter(d => d);
                let currentRoomType = "";
                for (let r = 1; r < json.length; r++) {
                    const row = json[r];
                    if (row[0] !== null) { currentRoomType = row[0].trim(); }
                    if (!currentRoomType || !row[2]) continue;
                    const descriptor = row[2].trim();
                    if (!hotelData[currentRoomType]) hotelData[currentRoomType] = { stock: {}, plans: {} };
                    if (descriptor.toLowerCase().includes('left for sale')) {
                        datesHeader.forEach((date, i) => { hotelData[currentRoomType].stock[date] = row[i + 3]; });
                    } else if (descriptor.toLowerCase().includes('price (eur)')) {
                        const ratePlan = row[1]?.trim();
                        if (!ratePlan) continue;
                        if (!hotelData[currentRoomType].plans[ratePlan]) hotelData[currentRoomType].plans[ratePlan] = {};
                        datesHeader.forEach((date, i) => { hotelData[currentRoomType].plans[ratePlan][date] = row[i + 3]; });
                    }
                }
                const allRoomsFromFile = Object.keys(hotelData).sort();
                const allPlansFromFile = new Set();
                allRoomsFromFile.forEach(room => Object.keys(hotelData[room].plans).forEach(plan => allPlansFromFile.add(plan)));
                appConfig.displayOrder.rooms = [...new Set([...(appConfig.displayOrder.rooms || []), ...allRoomsFromFile])];
                appConfig.displayOrder.plans = [...new Set([...(appConfig.displayOrder.plans || []), ...Array.from(allPlansFromFile).sort()])];
                updateAllUI();
                document.getElementById('simulateBtn').disabled = false;
                document.getElementById('availabilityBtn').disabled = false;
                showToast("Fichier chargé avec succès !", "success");
            } catch (error) {
                console.error("Erreur de parsing:", error);
                showToast("Erreur de lecture du fichier. Vérifiez son format.", "error");
                hotelData = {}; reportInfo = ""; updateAllUI();
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSimulation = (event) => {
        event.preventDefault();
        const room = document.getElementById('roomSelect').value, plan = document.getElementById('planSelect').value, start = document.getElementById('simStartDate').value, end = document.getElementById('simEndDate').value, partner = document.getElementById('partnerSelect').value;
        if (!room || !plan || !start || !end) return showToast("Veuillez remplir tous les champs.", "error");
        if (new Date(end) <= new Date(start)) return showToast("La date de départ doit être après l'arrivée.", "error");
        displayLoading();
        setTimeout(() => {
            const results = [];
            for (let d = new Date(start); d < new Date(end); d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().split('T')[0];
                const stockData = hotelData[room]?.stock?.[key];
                const priceData = hotelData[room]?.plans?.[plan]?.[key];
                results.push({
                    date: key,
                    price: (priceData !== null && !isNaN(priceData)) ? parseFloat(priceData) : null,
                    stock: (stockData !== null && !isNaN(stockData)) ? parseInt(stockData, 10) : 0,
                });
            }
            const subTotal = results.reduce((acc, r) => acc + (r.price || 0), 0);
            const partnerInfo = appConfig.partners[partner];
            const commissionRate = (partnerInfo?.commission / 100) || 0;
            const rowsHTML = results.map(r => {
                const isAvailable = r.stock > 0 && r.price !== null;
                const netPrice = (commissionRate && r.price) ? r.price * (1 - commissionRate) : r.price;
                return `<tr class="border-b" data-gross-price="${r.price || 0}">
                    <td class="px-4 py-3">${formatDateForDisplay(r.date)}</td>
                    <td class="px-4 py-3 text-right">${r.price !== null ? r.price.toFixed(2) + ' €' : '–'}</td>
                    <td class="px-4 py-3 text-right font-semibold text-indigo-700 net-price-cell">${netPrice !== null ? netPrice.toFixed(2) + ' €' : '–'}</td>
                    <td class="px-4 py-3 text-center">${r.stock}</td>
                    <td class="px-4 py-3 text-center"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${isAvailable ? 'Disponible' : 'Non dispo.'}</span></td>
                </tr>`;
            }).join('');
            const table = `<table class="min-w-full"><thead class="bg-gray-50 sticky-header"><tr>
                <th class="px-4 py-2 text-left text-sm font-semibold text-gray-600">Date</th>
                <th class="px-4 py-2 text-right text-sm font-semibold text-gray-600">Prix Brut (€)</th>
                <th class="px-4 py-2 text-right text-sm font-semibold text-gray-600">Prix Net (€)</th>
                <th class="px-4 py-2 text-center text-sm font-semibold text-gray-600">Stock</th>
                <th class="px-4 py-2 text-center text-sm font-semibold text-gray-600">Disponibilité</th>
            </tr></thead><tbody class="bg-white text-sm">${rowsHTML}</tbody></table>`;
            lastResultsForExport = { type: 'simulation', data: { results, plan, partner, subTotal } };
            document.getElementById('resultTitle').textContent = `Simulation : ${room}`;
            document.getElementById('resultContent').innerHTML = table;
            displayFinancialSummary(subTotal, partner);
            hideLoading();
        }, 250);
    };

    const handleAvailabilitySearch = (event) => {
        event.preventDefault();
        const start = document.getElementById('availStartDate').value, end = document.getElementById('availEndDate').value;
        const selectedRooms = Array.from(document.querySelectorAll('#roomTypesContainer input:checked')).map(el => el.value);
        if (!start || !end || selectedRooms.length === 0) return showToast("Sélectionnez une période et au moins une chambre.", "error");
        if (new Date(end) < new Date(start)) return showToast("La date de fin doit être après le début.", "error");
        displayLoading();
        setTimeout(() => {
            const dates = []; for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) { dates.push(d.toISOString().split('T')[0]); }
            const dateHeaders = dates.map(d => formatDateForDisplay(d, { day: '2-digit', month: 'short'}));
            let headerHTML = `<th class="sticky-col bg-gray-100 px-3 py-3 text-left text-sm font-semibold text-gray-600">Type de Chambre</th>` + dateHeaders.map(h => `<th class="px-3 py-3 text-center text-sm font-semibold text-gray-600">${h.replace('. ', '.<br>')}</th>`).join('');
            let bodyHTML = "", exportData = [["Type de Chambre", ...dateHeaders]];
            (appConfig.displayOrder.rooms || []).filter(room => selectedRooms.includes(room)).forEach(room => {
                let rowHTML = `<td class="sticky-col bg-white hover:bg-indigo-50 px-3 py-3 font-medium text-gray-800 whitespace-nowrap">${room}</td>`;
                let exportRow = [room];
                dates.forEach(dateKey => {
                    const stock = hotelData[room]?.stock?.[dateKey];
                    const { cellClass, content } = getStockCell(stock);
                    rowHTML += `<td class="text-center font-semibold text-sm ${cellClass}">${content}</td>`;
                    exportRow.push(content);
                });
                bodyHTML += `<tr class="border-b">${rowHTML}</tr>`;
                exportData.push(exportRow);
            });
            const table = `<table class="min-w-full text-sm border-collapse"><thead class="bg-gray-100 sticky-header"><tr>${headerHTML}</tr></thead><tbody>${bodyHTML}</tbody></table>`;
            lastResultsForExport = { type: 'availability', data: exportData };
            document.getElementById('resultTitle').textContent = 'Tableau des Disponibilités';
            document.getElementById('resultContent').innerHTML = table;
            hideLoading();
        }, 250);
    };

    const displayFinancialSummary = (subTotal, partner) => {
        const financialSummary = document.getElementById('financialSummary');
        const partnerInfo = appConfig.partners[partner];
        const commissionRatePercent = partnerInfo?.commission;
        const commissionHtml = commissionRatePercent ? `
            <div class="flex items-center">
                <input type="checkbox" id="applyCommission" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked>
                <label for="applyCommission" class="ml-2 text-gray-700">Appliquer commission (${partner} ${commissionRatePercent}%)</label>
            </div>
        ` : '';
        financialSummary.innerHTML = `
            <div class="grid md:grid-cols-2 gap-8 items-start">
                <div class="space-y-4">
                    ${commissionHtml}
                    <div class="flex items-center">
                        <label for="discountInputPercent" class="text-gray-700 mr-2 whitespace-nowrap">Remise promotionnelle (%):</label>
                        <input type="number" id="discountInputPercent" placeholder="0" min="0" max="100" step="0.1" class="block w-24 py-1 px-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg space-y-2 text-right">
                    <div class="flex justify-between text-gray-800"><span class="font-medium">Sous-Total Brut:</span><span id="subTotalDisplay" class="font-bold">${subTotal.toFixed(2)} €</span></div>
                    <div id="commissionRow" class="hidden flex justify-between text-red-600"><span class="font-medium">Total Commission:</span><span id="commissionDisplay" class="font-semibold">0.00 €</span></div>
                    <div id="discountRow" class="hidden flex justify-between text-blue-600"><span class="font-medium">Remise:</span><span id="discountDisplay" class="font-semibold">0.00 €</span></div>
                    <div class="border-t pt-2 mt-2 flex justify-between text-xl font-bold text-gray-900"><span>Total Net Final:</span><span id="totalNetDisplay">0.00 €</span></div>
                </div>
            </div>`;
        financialSummary.classList.remove('hidden');
        const updateCallback = () => updateFinancials(subTotal, (commissionRatePercent / 100) || 0);
        if (commissionRatePercent) {
            document.getElementById('applyCommission').addEventListener('change', updateCallback);
        }
        document.getElementById('discountInputPercent').addEventListener('input', updateCallback);
        updateFinancials(subTotal, (commissionRatePercent / 100) || 0);
    };

    const updateFinancials = (subTotal, commissionRate) => {
        const applyCommission = document.getElementById('applyCommission')?.checked || false;
        const discountPercent = parseFloat(document.getElementById('discountInputPercent').value) || 0;
        document.querySelectorAll('#resultContent tbody tr').forEach(row => {
            const grossPrice = parseFloat(row.dataset.grossPrice);
            if (!isNaN(grossPrice)) {
                const netPrice = applyCommission && commissionRate ? grossPrice * (1 - commissionRate) : grossPrice;
                row.querySelector('.net-price-cell').textContent = netPrice.toFixed(2) + ' €';
            }
        });
        const commissionAmount = (applyCommission && commissionRate) ? subTotal * commissionRate : 0;
        const netSubTotal = subTotal - commissionAmount;
        const discountAmount = netSubTotal * (discountPercent / 100);
        const finalTotal = netSubTotal - discountAmount;
        document.getElementById('commissionRow').classList.toggle('hidden', !applyCommission || !commissionRate);
        document.getElementById('commissionDisplay').textContent = `-${commissionAmount.toFixed(2)} €`;
        document.getElementById('discountRow').classList.toggle('hidden', discountPercent <= 0);
        document.getElementById('discountDisplay').textContent = `-${discountAmount.toFixed(2)} €`;
        document.getElementById('totalNetDisplay').textContent = `${finalTotal.toFixed(2)} €`;
    };

    const exportResultsToExcel = () => {
        if (!lastResultsForExport) return showToast("Aucun résultat à exporter.", "error");
        let ws_data, filename;
        if (lastResultsForExport.type === 'simulation') {
            const { results, plan, partner } = lastResultsForExport.data;
            const commissionRate = (appConfig.partners[partner]?.commission / 100) || 0;
            const commissionIsApplied = document.getElementById('applyCommission')?.checked || false;
            ws_data = [["Date", "Plan Tarifaire", "Prix Brut (€)", "Prix Net (€)", "Stock", "Disponibilité"]];
            results.forEach(r => {
                const netPrice = (commissionIsApplied && commissionRate && r.price) ? r.price * (1 - commissionRate) : r.price;
                ws_data.push([
                    formatDateForDisplay(r.date),
                    plan,
                    r.price !== null ? r.price : '',
                    netPrice !== null ? netPrice : '',
                    r.stock,
                    (r.stock > 0 && r.price !== null) ? 'Disponible' : 'Non dispo.'
                ]);
            });
            ws_data.push([]);
            ws_data.push(["Résumé Financier"]);
            ws_data.push(["Sous-Total Brut", parseFloat(document.getElementById('subTotalDisplay').textContent.replace('€', ''))]);
            if (commissionIsApplied) {
                ws_data.push(["Total Commission", parseFloat(document.getElementById('commissionDisplay').textContent.replace('€', ''))]);
            }
            if ((parseFloat(document.getElementById('discountInputPercent').value) || 0) > 0) {
                 ws_data.push(["Remise", parseFloat(document.getElementById('discountDisplay').textContent.replace('€', ''))]);
            }
            ws_data.push(["Total Net Final", parseFloat(document.getElementById('totalNetDisplay').textContent.replace('€', ''))]);
            filename = `Simulation_${reportInfo.split(' - ')[0].replace(/\s/g, '_')}.xlsx`;
        } else {
            ws_data = lastResultsForExport.data;
            filename = `Disponibilites_${reportInfo.split(' - ')[0].replace(/\s/g, '_')}.xlsx`;
        }
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Resultats');
        XLSX.writeFile(wb, `${filename}`);
    };

    const toggleSelectAll = () => {
        const checkboxes = document.querySelectorAll('#roomTypesContainer input[type="checkbox"]');
        const shouldSelectAll = !Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => cb.checked = shouldSelectAll);
        document.getElementById('selectAllBtn').textContent = shouldSelectAll ? 'Tout désélectionner' : 'Tout sélectionner';
    };
    
    // ===================================================================================
    // SECTION 4: MODULE DE PARAMÈTRES
    // ===================================================================================

    const loadSettings = async () => {
        const defaultConfigUrl = localStorage.getItem('hotelDefaultConfigUrl');
        let configLoaded = false;
        if (defaultConfigUrl) {
            try {
                const response = await fetch(defaultConfigUrl);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                appConfig = deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), data);
                localStorage.setItem('hotelAppConfig', JSON.stringify(appConfig));
                showToast("Configuration par défaut chargée depuis l'URL.", "success");
                configLoaded = true;
            } catch (e) {
                console.error("Impossible de charger la config depuis l'URL:", e);
                showToast("Échec du chargement de la config par défaut.", "error");
            }
        }
        if (!configLoaded) {
            const savedSettings = localStorage.getItem('hotelAppConfig');
            try {
                const parsedSettings = savedSettings ? JSON.parse(savedSettings) : {};
                appConfig = deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), parsedSettings);
            } catch (e) {
                console.error("Erreur de chargement des paramètres locaux:", e);
                appConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            }
        }
        defaultConfigUrlInput.value = defaultConfigUrl || '';
    };

    const openSettingsModal = () => {
        renderPartnerList();
        renderDisplayOrderLists();
        settingsModal.classList.remove('hidden');
    };

    const saveSettingsAndClose = () => {
        appConfig.displayOrder.rooms = Array.from(roomOrderList.children).map(item => item.textContent.trim());
        appConfig.displayOrder.plans = Array.from(planOrderList.children).map(item => item.textContent.trim());
        const defaultConfigUrl = defaultConfigUrlInput.value.trim();
        if (defaultConfigUrl) {
            localStorage.setItem('hotelDefaultConfigUrl', defaultConfigUrl);
        } else {
            localStorage.removeItem('hotelDefaultConfigUrl');
        }
        localStorage.setItem('hotelAppConfig', JSON.stringify(appConfig));
        showToast("Paramètres sauvegardés et appliqués !", "success");
        settingsModal.classList.add('hidden');
        updateAllUI();
    };

    const renderPartnerList = () => {
        partnerListContainer.innerHTML = '';
        if (!appConfig.partners || Object.keys(appConfig.partners).length === 0) {
            partnerListContainer.innerHTML = `<p class="text-center text-gray-500 p-8">Aucun partenaire configuré. Ajoutez-en un !</p>`; return;
        }
        Object.entries(appConfig.partners).sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, data]) => {
            const commissionText = data.commission !== null && data.commission !== undefined ? `${data.commission}%` : 'N/A';
            const codesText = (data.codes || []).join(', ');
            const partnerEl = document.createElement('div');
            partnerEl.className = 'partner-item';
            partnerEl.innerHTML = `<div class="partner-details"><h4>${name}</h4><p>Commission: <strong>${commissionText}</strong></p><p class="codes" title="${codesText}">Codes: ${codesText || "Aucun"}</p></div><div class="partner-actions"><button class="btn-secondary text-sm py-1 px-2" data-name="${name}"><i class="fas fa-pen"></i></button><button class="btn-secondary text-sm py-1 px-2 !bg-red-100 !text-red-700 hover:!bg-red-200" data-name="${name}"><i class="fas fa-trash"></i></button></div>`;
            partnerEl.querySelector('.fa-pen').parentElement.addEventListener('click', () => editPartner(name));
            partnerEl.querySelector('.fa-trash').parentElement.addEventListener('click', () => deletePartner(name));
            partnerListContainer.appendChild(partnerEl);
        });
    };

    const editPartner = (name) => {
        const data = appConfig.partners[name];
        document.getElementById('originalPartnerName').value = name;
        document.getElementById('partnerName').value = name;
        document.getElementById('partnerCommission').value = data.commission;
        document.getElementById('partnerCodes').value = (data.codes || []).join(', ');
        partnerFormTitle.textContent = "Modifier un partenaire";
        document.getElementById('savePartnerBtn').innerHTML = `<i class="fas fa-save mr-2"></i>Modifier`;
    };

    const deletePartner = (name) => {
        if (confirm(`Êtes-vous sûr de vouloir supprimer le partenaire "${name}" ?`)) {
            delete appConfig.partners[name];
            renderPartnerList();
            showToast(`Partenaire "${name}" supprimé.`, 'success');
        }
    };

    const clearPartnerForm = () => {
        partnerForm.reset();
        document.getElementById('originalPartnerName').value = '';
        partnerFormTitle.textContent = "Ajouter un partenaire";
        document.getElementById('savePartnerBtn').innerHTML = `<i class="fas fa-plus mr-2"></i>Ajouter`;
    };

    const handleSavePartner = (event) => {
        event.preventDefault();
        const originalName = document.getElementById('originalPartnerName').value;
        const newName = document.getElementById('partnerName').value.trim();
        const commission = document.getElementById('partnerCommission').value;
        const codes = document.getElementById('partnerCodes').value.split(',').map(c => c.trim()).filter(c => c);
        if (!newName) return showToast("Le nom du partenaire est obligatoire.", "error");
        if (originalName && originalName !== newName) delete appConfig.partners[originalName];
        appConfig.partners[newName] = { commission: commission ? parseFloat(commission) : null, codes: codes };
        showToast(`Partenaire "${newName}" sauvegardé.`, 'success');
        renderPartnerList();
        clearPartnerForm();
    };

    const handleImportSettings = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedSettings = JSON.parse(e.target.result);
                if (typeof importedSettings !== 'object' || importedSettings === null || !importedSettings.partners || !importedSettings.displayOrder) throw new Error("Format de fichier invalide.");
                appConfig = deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), importedSettings);
                renderPartnerList();
                renderDisplayOrderLists();
                showToast("Configuration importée avec succès.", "success");
            } catch (err) {
                console.error("Erreur d'importation:", err);
                showToast("Erreur: Le fichier de configuration est invalide ou corrompu.", "error");
            }
        };
        reader.readAsText(file);
        importSettingsInput.value = '';
    };

    const handleExportSettings = () => {
        const configToExport = JSON.parse(JSON.stringify(appConfig));
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(configToExport, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "config_simulateur_hotel.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        showToast("Configuration exportée.", "success");
    };

    const renderDisplayOrderLists = () => {
        const createItem = (text) => `<div class="draggable-item">${text}</div>`;
        roomOrderList.innerHTML = (appConfig.displayOrder.rooms || []).map(createItem).join('');
        planOrderList.innerHTML = (appConfig.displayOrder.plans || []).map(createItem).join('');
        new Sortable(roomOrderList, { animation: 150, ghostClass: 'sortable-ghost' });
        new Sortable(planOrderList, { animation: 150, ghostClass: 'sortable-ghost' });
    };

    // ===================================================================================
    // SECTION 5: INITIALISATION ET ATTACHE DES ÉCOUTEURS
    // ===================================================================================
    const attachEventListeners = () => {
        // CORRECTION: Sélectionner les éléments ici, APRES l'injection HTML
        const exportBtn = document.getElementById('exportBtn');
        const simulationForm = document.getElementById('simulationForm');
        const availabilityForm = document.getElementById('availabilityForm');
        const partnerSelect = document.getElementById('partnerSelect');
        const roomSelect = document.getElementById('roomSelect');
        const selectAllBtn = document.getElementById('selectAllBtn');
        const clearPartnerFormBtn = document.getElementById('clearPartnerFormBtn');
        
        fileInput.addEventListener('change', handleFileSelect);
        resetBtn.addEventListener('click', resetUI);
        exportBtn.addEventListener('click', exportResultsToExcel);
        document.querySelectorAll('#main-tools .flex button').forEach(btn => btn.addEventListener('click', () => switchTab(btn.id.replace('tab-', ''))));
        simulationForm.addEventListener('submit', handleSimulation);
        availabilityForm.addEventListener('submit', handleAvailabilitySearch);
        partnerSelect.addEventListener('change', updatePlans);
        roomSelect.addEventListener('change', updatePlans);
        selectAllBtn.addEventListener('click', toggleSelectAll);
        openSettingsBtn.addEventListener('click', openSettingsModal);
        document.querySelectorAll('.modal-close-btn, .btn-secondary[data-modal-id]').forEach(btn => {
            btn.addEventListener('click', (e) => document.getElementById(e.currentTarget.dataset.modalId).classList.add('hidden'));
        });
        partnerForm.addEventListener('submit', handleSavePartner);
        clearPartnerFormBtn.addEventListener('click', clearPartnerForm);
        saveSettingsBtn.addEventListener('click', saveSettingsAndClose);
        importSettingsBtn.addEventListener('click', () => importSettingsInput.click());
        importSettingsInput.addEventListener('change', handleImportSettings);
        exportSettingsBtn.addEventListener('click', handleExportSettings);
        clearDefaultConfigUrlBtn.addEventListener('click', () => { defaultConfigUrlInput.value = ''; });
        document.querySelectorAll('.settings-tabs .tab-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                document.querySelectorAll('.settings-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
                e.currentTarget.classList.add('active');
                document.querySelectorAll('.modal-body .tab-content').forEach(content => content.classList.add('hidden'));
                document.getElementById(`tab-content-${tabId}`).classList.remove('hidden');
            });
        });
    };

    const initializeApp = async () => {
        injectHTMLContent();
        await loadSettings();
        attachEventListeners();
        updateAllUI();
        switchTab('simulator');
    };

    // --- DÉMARRAGE DE L'APPLICATION ---
    initializeApp();
});