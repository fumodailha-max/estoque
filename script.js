// script.js
document.addEventListener('DOMContentLoaded', async () => {
    // Configurações do Firebase - SUBSTITUA PELAS SUAS CREDENCIAIS
const firebaseConfig = {
  apiKey: "AIzaSyBszbg1MsMFxK5Si_VuXzdQZTpKfAmiAME",
  authDomain: "fdiestoque.firebaseapp.com",
  projectId: "fdiestoque",
  storageBucket: "fdiestoque.firebasestorage.app",
  messagingSenderId: "125497955543",
  appId: "1:125497955543:web:c820dcb7e2a99ffdcc0c92"
};

    // Variáveis globais para Firebase
    let db, auth, userId, appId;
    let products = [];
    let customers = [];
    let cart = [];
    let currentPage = 'estoque'; // 'estoque', 'clientes', 'vendas'

    // Referências DOM
    const appContent = document.getElementById('app-content');
    const loadingIndicator = document.getElementById('loading-indicator');
    const navEstoqueBtn = document.getElementById('nav-estoque');
    const navClientesBtn = document.getElementById('nav-clientes');
    const navVendasBtn = document.getElementById('nav-vendas');
    const userIdDisplay = document.getElementById('user-id-display');
    const appIdDisplay = document.getElementById('app-id-display');

    // Referências para o modal customizado
    const customModal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');

    // --- Funções Utilitárias ---

    // Formato de moeda BRL
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    // Exibir/Esconder loading
    const showLoading = (show) => {
        if (show) {
            loadingIndicator.classList.remove('hidden');
            appContent.classList.add('hidden');
        } else {
            loadingIndicator.classList.add('hidden');
            appContent.classList.remove('hidden');
        }
    };

    // Função para mostrar modal customizado
    const showCustomModal = (title, messageHtml, onConfirm, onCancel, confirmText = 'Confirmar', cancelText = 'Cancelar') => {
        modalTitle.innerHTML = title;
        if (typeof messageHtml === 'string') {
            modalMessage.innerHTML = messageHtml;
        } else {
            modalMessage.innerHTML = '';
            modalMessage.appendChild(messageHtml);
        }
        modalConfirmBtn.textContent = confirmText;
        modalCancelBtn.textContent = cancelText;

        customModal.classList.remove('hidden');

        modalConfirmBtn.onclick = () => {
            onConfirm();
            customModal.classList.add('hidden');
        };
        modalCancelBtn.onclick = () => {
            if (onCancel) onCancel();
            customModal.classList.add('hidden');
        };
    };

    // --- Inicialização do Firebase e Autenticação ---

    const initializeFirebase = async () => {
        showLoading(true);
        try {
            // Usa window.firebase porque os imports são type="module" e precisamos acessar de script normal
            const app = window.firebase.initializeApp(firebaseConfig);
            db = window.firebase.getFirestore(app);
            auth = window.firebase.getAuth(app);
            appId = firebaseConfig.projectId; // Usando projectId como appId para GitHub Pages

            appIdDisplay.textContent = `ID do Aplicativo: ${appId}`;

            // Autenticação anônima para simplicidade no GitHub Pages
            await window.firebase.signInAnonymously(auth);
            userId = auth.currentUser.uid;
            userIdDisplay.textContent = `ID do Usuário: ${userId}`;

            console.log("Firebase inicializado e autenticado como:", userId);
        } catch (error) {
            console.error("Erro ao inicializar Firebase:", error);
            appContent.innerHTML = `<div class="text-center text-red-500 text-lg mt-8">Erro ao carregar a aplicação. Por favor, verifique suas configurações do Firebase e sua conexão com a internet.</div>`;
        } finally {
            showLoading(false);
        }
    };

    // --- Funções de Carregamento de Dados ---

    const loadProducts = () => {
        if (!db || !userId) return;
        const productsCollectionRef = window.firebase.collection(db, `artifacts/${appId}/users/${userId}/products`);
        window.firebase.onSnapshot(productsCollectionRef, (snapshot) => {
            products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (currentPage === 'estoque') renderEstoqueView();
            if (currentPage === 'vendas') renderVendasView();
            lucide.createIcons(); // Recarregar ícones após renderizar novo conteúdo
        }, (err) => {
            console.error("Erro ao carregar produtos:", err);
            appContent.innerHTML = `<div class="text-center text-red-500 text-lg mt-8">Erro ao carregar produtos.</div>`;
        });
    };

    const loadCustomers = () => {
        if (!db || !userId) return;
        const customersCollectionRef = window.firebase.collection(db, `artifacts/${appId}/users/${userId}/customers`);
        window.firebase.onSnapshot(customersCollectionRef, (snapshot) => {
            customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (currentPage === 'clientes') renderClientesView();
            if (currentPage === 'vendas') renderVendasView();
            lucide.createIcons(); // Recarregar ícones após renderizar novo conteúdo
        }, (err) => {
            console.error("Erro ao carregar clientes:", err);
            appContent.innerHTML = `<div class="text-center text-red-500 text-lg mt-8">Erro ao carregar clientes.</div>`;
        });
    };

    // --- Funções de Renderização das Views ---

    const renderEstoqueView = () => {
        appContent.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl p-6 mb-8">
                <h2 class="text-3xl font-bold mb-6 text-gray-800 flex items-center">
                    <i data-lucide="package" class="mr-3"></i> Gerenciar Estoque
                </h2>

                <!-- Formulário de Produto -->
                <form id="product-form" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8 p-4 bg-gray-50 rounded-lg shadow-inner">
                    <div class="col-span-1 md:col-span-2 lg:col-span-1">
                        <label for="product-name" class="block text-sm font-medium text-gray-700">Nome do Produto</label>
                        <input type="text" id="product-name" name="name" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2" required />
                    </div>
                    <div>
                        <label for="product-quantity" class="block text-sm font-medium text-gray-700">Quantidade</label>
                        <input type="number" id="product-quantity" name="quantity" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2" required />
                    </div>
                    <div>
                        <label for="product-cost-price" class="block text-sm font-medium text-gray-700">Preço de Custo (R$)</label>
                        <input type="number" id="product-cost-price" name="costPrice" step="0.01" class="m
