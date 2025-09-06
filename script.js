// Importa os módulos do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variáveis globais
window.firebaseApp = null;
window.db = null;
window.auth = null;
window.currentUser = { uid: null, role: null };
let currentProducts = [];
let currentCustomers = [];
let saleCart = [];
let selectedCustomerForSale = '';
let currentPaymentType = 'cash';
let customerToPayId = null;

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBszbg1MsMFxK5Si_VuXzdQZTpKfAmiAME",
    authDomain: "fdiestoque.firebaseapp.com",
    projectId: "fdiestoque",
    storageBucket: "fdiestoque.firebasestorage.app",
    messagingSenderId: "125497955543",
    appId: "1:125497955543:web:c820dcb7e2a99ffdcc0c92"
};

// --- Funções de Autenticação e Inicialização ---
const initFirebaseAndAuth = async () => {
    try {
        window.firebaseApp = initializeApp(firebaseConfig);
        window.db = getFirestore(window.firebaseApp);
        window.auth = getAuth(window.firebaseApp);

        onAuthStateChanged(window.auth, async (user) => {
            const isLoginPage = window.location.pathname.endsWith('login.html');
            const dashboardNavButton = document.getElementById('nav-dashboard');

            if (user) {
                const userRef = doc(window.db, `users`, user.uid);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                    window.currentUser.uid = user.uid;
                    window.currentUser.role = userSnap.data().role;
                    console.log("Role do usuário:", window.currentUser.role);

                    if (dashboardNavButton) {
                        dashboardNavButton.style.display = window.currentUser.role === 'admin' ? 'flex' : 'none';
                    }
                    
                    if (isLoginPage) {
                        window.location.href = 'index.html';
                    } else {
                        loadPage('estoque');
                    }
                } else {
                    console.log("Nenhum documento de usuário encontrado. Saindo.");
                    signOut(window.auth);
                }
            } else {
                window.currentUser = { uid: null, role: null };
                if (dashboardNavButton) dashboardNavButton.style.display = 'none';
                if (!isLoginPage) {
                    window.location.href = 'login.html';
                }
            }
        });
    } catch (error) {
        console.error("Erro ao inicializar Firebase:", error);
    }
};

const handleLoginForm = async (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessageElem = document.getElementById('error-message');
    errorMessageElem.classList.add('hidden');

    try {
        await signInWithEmailAndPassword(window.auth, email, password);
    } catch (error) {
        let message = "Erro ao fazer login. Tente novamente.";
        if (['auth/invalid-email', 'auth/user-not-found', 'auth/wrong-password'].includes(error.code)) {
            message = "E-mail ou senha inválidos.";
        }
        errorMessageElem.textContent = message;
        errorMessageElem.classList.remove('hidden');
        console.error("Erro de login:", error);
    }
};

window.handleSignOut = () => {
    signOut(window.auth).catch((error) => {
        console.error("Erro ao fazer logout:", error);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    initFirebaseAndAuth();
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLoginForm);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Lógica para o menu hambúrguer
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navLinks = document.getElementById('nav-links');

    if(hamburgerBtn && navLinks){
        hamburgerBtn.addEventListener('click', () => {
            navLinks.classList.toggle('hidden');
        });
    }
});

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const showModal = (title, message, onConfirm, onCancel = null, confirmText = 'Confirmar', cancelText = 'Cancelar', contentHtml = '') => {
    const modal = document.getElementById('custom-modal');
    if (!modal) return;
    document.getElementById('modal-title').innerHTML = `<i data-lucide="info" class="mr-2 text-blue-500" style="width: 24px; height: 24px;"></i> ${title}`;
    document.getElementById('modal-message').innerHTML = message;
    document.getElementById('modal-content-area').innerHTML = contentHtml;
    lucide.createIcons();
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    confirmBtn.textContent = confirmText;
    
    confirmBtn.onclick = () => { 
        if (onConfirm) onConfirm();
        if (onCancel !== null) { // Apenas fecha o modal se houver uma ação de cancelamento (evita fechar modais de sucesso/erro)
            hideModal();
        }
    };
    
    cancelBtn.style.display = onCancel ? 'inline-block' : 'none';
    if (onCancel) {
        cancelBtn.textContent = cancelText;
        cancelBtn.onclick = () => { hideModal(); onCancel(); };
    }
    modal.classList.remove('hidden');
};

const hideModal = () => {
    const modal = document.getElementById('custom-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('modal-content-area').innerHTML = '';
    }
};

window.loadPage = (pageName) => {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.innerHTML = 'Carregando...';

    // Fecha o menu hambúrguer ao carregar uma nova página (importante para mobile)
    const navLinks = document.getElementById('nav-links');
    if (navLinks && !navLinks.classList.contains('md:flex')) {
         navLinks.classList.add('hidden');
    }

    if (pageName === 'dashboard' && window.currentUser.role !== 'admin') {
        mainContent.innerHTML = `<div class="bg-gray-800 rounded-lg p-8 text-center mt-12"><h2 class="text-3xl font-bold text-red-500 mb-4">Acesso Negado</h2><p class="text-gray-400">Você não tem permissão para acessar o Dashboard.</p></div>`;
        document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('nav-active'));
        document.getElementById(`nav-${pageName}`).classList.add('nav-active');
        return;
    }

    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('nav-active'));
    const activeButton = document.getElementById(`nav-${pageName}`);
    if(activeButton) activeButton.classList.add('nav-active');

    const pages = {
        estoque: renderEstoqueView,
        clientes: renderClientesView,
        vendas: renderVendasView,
        dashboard: renderDashboardView
    };
    (pages[pageName] || (() => { mainContent.innerHTML = `<div class="text-center text-lg mt-8 text-gray-600">Página não encontrada.</div>`; }))();
};

const deleteProduct = async (productId) => {
    try {
        await deleteDoc(doc(window.db, "products", productId));
        showModal('Sucesso!', 'Produto excluído com sucesso.', () => hideModal());
    } catch (err) {
        console.error("Erro ao excluir produto:", err);
        showModal('Erro!', 'Erro ao excluir produto. Tente novamente.', () => hideModal());
    }
};
window.confirmDeleteProduct = (productId, productName) => showModal('Confirmar Exclusão', `Tem certeza que deseja excluir o produto "${productName}"?`, () => deleteProduct(productId), () => {}, 'Excluir', 'Cancelar');

const deleteCustomer = async (customerId) => {
    try {
        await deleteDoc(doc(window.db, "customers", customerId));
        showModal('Sucesso!', 'Cliente excluído com sucesso.', () => hideModal());
    } catch (err) {
        console.error("Erro ao excluir cliente:", err);
        showModal('Erro!', 'Erro ao excluir cliente. Tente novamente.', () => hideModal());
    }
};
window.confirmDeleteCustomer = (customerId, customerName) => showModal('Confirmar Exclusão', `Tem certeza que deseja excluir o cliente "${customerName}"?`, () => deleteCustomer(customerId), () => {}, 'Excluir', 'Cancelar');

const handlePay = async () => {
    const paymentAmountInput = document.getElementById('payment-amount');
    const errorMessage = document.getElementById('payment-error-message');

    if (!paymentAmountInput || !errorMessage) {
        console.error("Elementos do modal de pagamento não encontrados.");
        return;
    }

    const paymentAmount = parseFloat(paymentAmountInput.value);
    const customer = currentCustomers.find(c => c.id === customerToPayId);

    if (isNaN(paymentAmount) || paymentAmount <= 0 || !customer || paymentAmount > customer.totalDue) {
        errorMessage.textContent = "Valor de pagamento inválido.";
        errorMessage.classList.remove('hidden');
        return;
    }

    try {
        const newTotalDue = (customer.totalDue || 0) - paymentAmount;
        await updateDoc(doc(window.db, "customers", customerToPayId), { totalDue: newTotalDue });
        
        await addDoc(collection(window.db, "transactions"), {
            type: 'payment',
            customerId: customerToPayId,
            customerName: customer.name,
            amount: paymentAmount,
            date: new Date().toISOString(),
        });

        hideModal();
        showModal('Sucesso!', 'Pagamento registrado com sucesso!', () => hideModal());
        customerToPayId = null;

    } catch (err) {
        console.error("Erro ao registrar pagamento:", err);
        errorMessage.textContent = "Erro ao registrar pagamento. Tente novamente.";
        errorMessage.classList.remove('hidden');
    }
};

window.openPayModal = (customerId) => {
    const customer = currentCustomers.find(c => c.id === customerId);
    if (!customer) return;
    customerToPayId = customerId;
    const contentHtml = `
        <p class="mb-2">Dívida atual: <span class="font-semibold text-orange-400">${formatCurrency(customer.totalDue || 0)}</span></p>
        <label for="payment-amount" class="block text-sm font-medium text-gray-400 mb-1">Valor do Pagamento (R$)</label>
        <input type="number" id="payment-amount" step="0.01" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-green-500 focus:ring-green-500 p-2" required max="${customer.totalDue}" />
        <p id="payment-error-message" class="text-red-500 text-xs mt-2 hidden"></p>
    `;
    showModal(`Registrar Pagamento para ${customer.name}`, '', handlePay, () => { customerToPayId = null; }, 'Registrar Pagamento', 'Cancelar', contentHtml);
};

// --- Renderização da View de Estoque ---
const renderEstoqueView = () => {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="bg-gray-900 rounded-lg border border-orange-600/50 shadow-neon p-6 mb-8">
            <h2 class="text-3xl font-chakra font-bold mb-6 text-orange-400 flex items-center"><i data-lucide="package" class="mr-3 text-orange-600"></i> Gerenciar Estoque</h2>
            <div class="mb-6">
                <div class="relative">
                    <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><i data-lucide="search" class="w-5 h-5 text-gray-500"></i></div>
                    <input type="text" id="product-search" placeholder="Pesquisar por nome do produto..." class="block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2 pl-10">
                </div>
            </div>
            <form id="product-form" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8 p-4 bg-gray-800 rounded-lg border-2 border-gray-700">
                <input type="hidden" id="product-id">
                <div class="col-span-1 md:col-span-2 lg:col-span-1"><label for="product-name" class="block text-sm font-medium text-gray-400">Nome do Produto</label><input type="text" id="product-name" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2" required></div>
                <div><label for="product-barcode" class="block text-sm font-medium text-gray-400">Código de Barras</label><input type="text" id="product-barcode" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2"></div>
                <div><label for="product-quantity" class="block text-sm font-medium text-gray-400">Quantidade</label><input type="number" id="product-quantity" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2" required></div>
                <div><label for="product-cost-price" class="block text-sm font-medium text-gray-400">Preço de Custo (R$)</label><input type="number" id="product-cost-price" step="0.01" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2" required></div>
                <div><label for="product-sell-price" class="block text-sm font-medium text-gray-400">Preço de Venda (R$)</label><input type="number" id="product-sell-price" step="0.01" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2" required></div>
                <div class="col-span-full lg:col-span-1 flex items-end justify-end space-x-2">
                    <button type="submit" id="product-submit-btn" class="w-full lg:w-auto px-4 py-2 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 transition-colors flex items-center justify-center shadow-orange"><i data-lucide="plus" class="mr-2"></i> Adicionar Produto</button>
                    <button type="button" id="product-cancel-edit-btn" class="hidden w-full lg:w-auto px-4 py-2 bg-gray-400 text-white font-medium rounded-md hover:bg-gray-500 transition-colors flex items-center justify-center"><i data-lucide="x-circle" class="mr-2"></i> Cancelar</button>
                </div>
            </form>
            <div id="product-error-message" class="text-red-500 text-center mb-4 hidden"></div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-700 rounded-lg overflow-hidden border border-gray-700">
                    <thead class="bg-gray-800"><tr><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Produto</th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Código de Barras</th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Quantidade</th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Custo</th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Venda</th><th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Ações</th></tr></thead>
                    <tbody id="products-table-body" class="bg-gray-900 divide-y divide-gray-700"></tbody>
                </table>
                <p id="no-products-message" class="px-6 py-4 text-center text-sm text-gray-500 hidden">Nenhum produto cadastrado.</p>
            </div>
        </div>`;
    lucide.createIcons();
    document.getElementById('product-form').addEventListener('submit', handleProductSubmit);
    document.getElementById('product-cancel-edit-btn').addEventListener('click', cancelEditProduct);
    document.getElementById('product-search').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredProducts = currentProducts.filter(p => p.name.toLowerCase().includes(searchTerm));
        displayProducts(filteredProducts);
    });
    loadProducts();
};

const loadProducts = () => {
    if (!window.db) return;
    const productsCollectionRef = collection(window.db, "products");
    onSnapshot(productsCollectionRef, (snapshot) => {
        currentProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayProducts(currentProducts);
    }, (err) => console.error("Erro ao carregar produtos:", err));
};

const displayProducts = (products) => {
    const tableBody = document.getElementById('products-table-body');
    const noProductsMessage = document.getElementById('no-products-message');
    if (!tableBody || !noProductsMessage) return;
    tableBody.innerHTML = '';
    noProductsMessage.classList.toggle('hidden', products.length > 0);
    products.forEach(product => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-300">${product.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${product.barcode || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${product.quantity}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${formatCurrency(product.costPrice)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${formatCurrency(product.sellPrice)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button onclick="window.editProduct('${product.id}')" class="text-blue-400 hover:text-blue-500">Editar</button>
                <button onclick="window.confirmDeleteProduct('${product.id}', '${product.name}')" class="text-red-400 hover:text-red-500">Excluir</button>
            </td>`;
    });
};

const handleProductSubmit = async (event) => {
    event.preventDefault();
    const errorMessage = document.getElementById('product-error-message');
    errorMessage.classList.add('hidden');
    const productId = document.getElementById('product-id').value;
    const productData = {
        name: document.getElementById('product-name').value.trim(),
        barcode: document.getElementById('product-barcode').value.trim(),
        quantity: parseInt(document.getElementById('product-quantity').value),
        costPrice: parseFloat(document.getElementById('product-cost-price').value),
        sellPrice: parseFloat(document.getElementById('product-sell-price').value),
    };
    if (!productData.name || isNaN(productData.quantity) || isNaN(productData.costPrice) || isNaN(productData.sellPrice)) {
        errorMessage.textContent = "Por favor, preencha todos os campos corretamente.";
        errorMessage.classList.remove('hidden');
        return;
    }
    try {
        if (productId) {
            await updateDoc(doc(window.db, "products", productId), productData);
            showModal('Sucesso!', `O produto "${productData.name}" foi atualizado.`, () => hideModal());
        } else {
            await addDoc(collection(window.db, "products"), productData);
            showModal('Sucesso!', `O produto "${productData.name}" foi adicionado.`, () => hideModal());
        }
        cancelEditProduct();
    } catch (err) {
        console.error("Erro ao salvar produto:", err);
        errorMessage.textContent = "Erro ao salvar produto. Tente novamente.";
        errorMessage.classList.remove('hidden');
    }
};

const cancelEditProduct = () => {
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-submit-btn').innerHTML = `<i data-lucide="plus" class="mr-2"></i> Adicionar Produto`;
    document.getElementById('product-cancel-edit-btn').classList.add('hidden');
    lucide.createIcons();
};
window.editProduct = (productId) => {
    const product = currentProducts.find(p => p.id === productId);
    if (product) {
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-barcode').value = product.barcode || '';
        document.getElementById('product-quantity').value = product.quantity;
        document.getElementById('product-cost-price').value = product.costPrice;
        document.getElementById('product-sell-price').value = product.sellPrice;
        document.getElementById('product-submit-btn').innerHTML = `<i data-lucide="check-circle" class="mr-2"></i> Atualizar Produto`;
        document.getElementById('product-cancel-edit-btn').classList.remove('hidden');
        lucide.createIcons();
    }
};

// --- Renderização da View de Clientes ---
const renderClientesView = () => {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="bg-gray-900 rounded-lg border border-orange-600/50 shadow-neon p-6 mb-8">
            <h2 class="text-3xl font-chakra font-bold mb-6 text-orange-400 flex items-center"><i data-lucide="users" class="mr-3 text-orange-600"></i> Gerenciar Clientes</h2>
            <form id="customer-form" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 p-4 bg-gray-800 rounded-lg border-2 border-gray-700">
                <input type="hidden" id="customer-id">
                <div class="col-span-1 md:col-span-1"><label for="customer-name" class="block text-sm font-medium text-gray-400">Nome do Cliente</label><input type="text" id="customer-name" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2" required></div>
                <div><label for="customer-phone" class="block text-sm font-medium text-gray-400">Telefone</label><input type="text" id="customer-phone" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2"></div>
                <div class="col-span-full md:col-span-1 flex items-end justify-end space-x-2">
                    <button type="submit" id="customer-submit-btn" class="w-full md:w-auto px-4 py-2 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 transition-colors flex items-center justify-center shadow-orange"><i data-lucide="plus" class="mr-2"></i> Adicionar Cliente</button>
                    <button type="button" id="customer-cancel-edit-btn" class="hidden w-full md:w-auto px-4 py-2 bg-gray-400 text-white font-medium rounded-md hover:bg-gray-500 transition-colors flex items-center justify-center"><i data-lucide="x-circle" class="mr-2"></i> Cancelar</button>
                </div>
            </form>
            <div id="customer-error-message" class="text-red-500 text-center mb-4 hidden"></div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-700 rounded-lg overflow-hidden border border-gray-700">
                    <thead class="bg-gray-800"><tr><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nome</th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Telefone</th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Dívida Total</th><th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Ações</th></tr></thead>
                    <tbody id="customers-table-body" class="bg-gray-900 divide-y divide-gray-700"></tbody>
                </table>
                <p id="no-customers-message" class="px-6 py-4 text-center text-sm text-gray-500 hidden">Nenhum cliente cadastrado.</p>
            </div>
        </div>`;
    lucide.createIcons();
    document.getElementById('customer-form').addEventListener('submit', handleCustomerSubmit);
    document.getElementById('customer-cancel-edit-btn').addEventListener('click', cancelEditCustomer);
    loadCustomers();
};

const loadCustomers = () => {
    if (!window.db) return;
    const customersCollectionRef = collection(window.db, "customers");
    onSnapshot(customersCollectionRef, (snapshot) => {
        currentCustomers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayCustomers(currentCustomers);
    }, (err) => console.error("Erro ao carregar clientes:", err));
};

const displayCustomers = (customers) => {
    const tableBody = document.getElementById('customers-table-body');
    const noCustomersMessage = document.getElementById('no-customers-message');
    if (!tableBody || !noCustomersMessage) return;
    tableBody.innerHTML = '';
    noCustomersMessage.classList.toggle('hidden', customers.length > 0);
    customers.forEach(customer => {
        const totalDue = customer.totalDue || 0;
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-300">${customer.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${customer.phone || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${totalDue > 0 ? 'text-orange-400' : 'text-green-400'}">${formatCurrency(totalDue)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button onclick="window.openPayModal('${customer.id}')" class="text-green-400 hover:text-green-500" ${totalDue <= 0 ? 'disabled' : ''}>Pagar</button>
                <button onclick="window.editCustomer('${customer.id}')" class="text-blue-400 hover:text-blue-500">Editar</button>
                <button onclick="window.confirmDeleteCustomer('${customer.id}', '${customer.name}')" class="text-red-400 hover:text-red-500">Excluir</button>
            </td>`;
    });
};

const handleCustomerSubmit = async (event) => {
    event.preventDefault();
    const errorMessage = document.getElementById('customer-error-message');
    errorMessage.classList.add('hidden');
    const customerId = document.getElementById('customer-id').value;
    const customerData = {
        name: document.getElementById('customer-name').value.trim(),
        phone: document.getElementById('customer-phone').value.trim(),
        totalDue: customerId ? (currentCustomers.find(c => c.id === customerId)?.totalDue || 0) : 0,
    };
    if (!customerData.name) {
        errorMessage.textContent = "Por favor, preencha o nome do cliente.";
        errorMessage.classList.remove('hidden');
        return;
    }
    try {
        if (customerId) {
            await updateDoc(doc(window.db, "customers", customerId), customerData);
            showModal('Sucesso!', `O cliente "${customerData.name}" foi atualizado.`, () => hideModal());
        } else {
            await addDoc(collection(window.db, "customers"), customerData);
            showModal('Sucesso!', `O cliente "${customerData.name}" foi adicionado.`, () => hideModal());
        }
        cancelEditCustomer();
    } catch (err) {
        console.error("Erro ao salvar cliente:", err);
        errorMessage.textContent = "Erro ao salvar cliente. Tente novamente.";
        errorMessage.classList.remove('hidden');
    }
};

const cancelEditCustomer = () => {
    document.getElementById('customer-form').reset();
    document.getElementById('customer-id').value = '';
    document.getElementById('customer-submit-btn').innerHTML = `<i data-lucide="plus" class="mr-2"></i> Adicionar Cliente`;
    document.getElementById('customer-cancel-edit-btn').classList.add('hidden');
    lucide.createIcons();
};
window.editCustomer = (customerId) => {
    const customer = currentCustomers.find(c => c.id === customerId);
    if (customer) {
        document.getElementById('customer-id').value = customer.id;
        document.getElementById('customer-name').value = customer.name;
        document.getElementById('customer-phone').value = customer.phone || '';
        document.getElementById('customer-submit-btn').innerHTML = `<i data-lucide="check-circle" class="mr-2"></i> Atualizar Cliente`;
        document.getElementById('customer-cancel-edit-btn').classList.remove('hidden');
        lucide.createIcons();
    }
};

// --- Renderização da View de Vendas ---
const renderVendasView = () => {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="bg-gray-900 rounded-lg border border-orange-600/50 shadow-neon p-6 mb-8">
            <h2 class="text-3xl font-chakra font-bold mb-6 text-orange-400 flex items-center"><i data-lucide="shopping-cart" class="mr-3 text-orange-600"></i> Realizar Venda</h2>
            <div id="sale-error-message" class="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-md relative mb-4 hidden" role="alert"><strong class="font-bold">Erro!</strong><span id="sale-error-text" class="block sm:inline ml-2"></span></div>
            <div id="sale-view-grid" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label for="barcode-scanner" class="block text-sm font-medium text-gray-400">Ler Código de Barras</label>
                            <div class="relative mt-1">
                                <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><i data-lucide="scan" class="w-5 h-5 text-gray-500"></i></div>
                                <input type="text" id="barcode-scanner" placeholder="Escaneie o produto..." class="block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2 pl-10">
                            </div>
                        </div>
                        <div>
                            <label for="vendas-product-search" class="block text-sm font-medium text-gray-400">Pesquisar por Nome</label>
                            <div class="relative mt-1">
                                <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><i data-lucide="search" class="w-5 h-5 text-gray-500"></i></div>
                                <input type="text" id="vendas-product-search" placeholder="Digite o nome do produto..." class="block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2 pl-10">
                            </div>
                        </div>
                    </div>
                    <h3 class="text-2xl font-chakra font-semibold mb-4 text-orange-400 flex items-center"><i data-lucide="package" class="mr-2 text-orange-600" style="width: 20px; height: 20px;"></i> Produtos</h3>
                    <div id="available-products-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-80 overflow-y-auto pr-2 custom-scrollbar"></div>
                    <p id="no-available-products-message" class="col-span-full text-center text-gray-500 py-8 hidden">Nenhum produto disponível em estoque.</p>
                </div>
                <div class="lg:col-span-1 bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h3 class="text-2xl font-chakra font-semibold mb-4 text-orange-400 flex items-center"><i data-lucide="shopping-cart" class="mr-2 text-orange-600" style="width: 20px; height: 20px;"></i> Carrinho</h3>
                    <div id="cart-items" class="space-y-3 mb-6 max-h-60 overflow-y-auto custom-scrollbar pr-2"></div>
                    <p id="empty-cart-message" class="text-gray-500 text-center py-4">Carrinho vazio.</p>
                    <div class="border-t border-gray-700 pt-4 mt-4"><p class="text-xl font-bold text-gray-300 flex justify-between items-center">Total: <span id="cart-total" class="text-orange-400">R$ 0,00</span></p></div>
                    <div class="mt-6 space-y-4">
                        <div><label class="block text-sm font-medium text-gray-400 mb-2">Tipo de Pagamento</label><div class="flex flex-wrap gap-4"><label class="flex items-center"><input type="radio" name="paymentType" value="cash" checked class="form-radio text-orange-600 bg-gray-700" onchange="window.updatePaymentType(this.value)"><span class="ml-2 text-gray-300">À Vista</span></label><label class="flex items-center"><input type="radio" name="paymentType" value="card" class="form-radio text-orange-600 bg-gray-700" onchange="window.updatePaymentType(this.value)"><span class="ml-2 text-gray-300">Cartão</span></label><label class="flex items-center"><input type="radio" name="paymentType" value="credit" class="form-radio text-orange-600 bg-gray-700" onchange="window.updatePaymentType(this.value)"><span class="ml-2 text-gray-300">Na Nota</span></label></div></div>
                        <div id="customer-select-container" class="hidden"><label for="sale-customer-select" class="block text-sm font-medium text-gray-400 mb-2">Selecionar Cliente</label><select id="sale-customer-select" class="block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2" required><option value="">Selecione um cliente</option></select></div>
                        <div id="card-type-container" class="hidden"><label class="block text-sm font-medium text-gray-400 mb-2">Tipo de Cartão</label><div class="flex space-x-4"><label class="flex items-center"><input type="radio" name="cardType" value="debit" checked class="form-radio text-orange-600 bg-gray-700"><span class="ml-2 text-gray-300">Débito</span></label><label class="flex items-center"><input type="radio" name="cardType" value="credit" class="form-radio text-orange-600 bg-gray-700"><span class="ml-2 text-gray-300">Crédito</span></label></div></div>
                        <button id="process-sale-btn" onclick="window.processSale()" class="w-full px-4 py-3 bg-orange-600 text-white font-bold rounded-md hover:bg-orange-700 transition-colors flex items-center justify-center text-lg shadow-orange" disabled><i data-lucide="dollar-sign" class="mr-2" style="width: 20px; height: 20px;"></i> Processar Venda</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();
    loadProductsForSale();
    loadCustomersForSale();
    document.getElementById('sale-customer-select').addEventListener('change', updateProcessSaleButtonState);
    document.querySelectorAll('input[name="paymentType"]').forEach(radio => radio.addEventListener('change', (e) => window.updatePaymentType(e.target.value)));
    document.getElementById('barcode-scanner').addEventListener('change', handleBarcodeScan);
    document.getElementById('vendas-product-search').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredProducts = currentProducts.filter(p => p.name.toLowerCase().includes(searchTerm));
        displayAvailableProducts(filteredProducts);
    });
    updatePaymentType('cash');
};

const handleBarcodeScan = (event) => {
    const barcode = event.target.value.trim();
    if (barcode) {
        const product = currentProducts.find(p => p.barcode === barcode);
        if (product) {
            window.addToCart(product.id);
        } else {
            showModal('Produto não encontrado', `Nenhum produto com o código de barras "${barcode}" foi encontrado.`, () => hideModal());
        }
        event.target.value = '';
    }
};

window.addToCart = (productId) => {
    const product = currentProducts.find(p => p.id === productId);
    if (!product) return;
    const itemInCart = saleCart.find(item => item.id === productId);
    if (itemInCart) {
        if (itemInCart.quantityInCart < product.quantity) {
            itemInCart.quantityInCart++;
        } else {
            showModal('Estoque Insuficiente', `Não há mais estoque para ${product.name}.`, () => hideModal());
        }
    } else {
        if (product.quantity > 0) {
            saleCart.push({ ...product, quantityInCart: 1 });
        } else {
            showModal('Fora de Estoque', `O produto ${product.name} está fora de estoque.`, () => hideModal());
        }
    }
    updateCartDisplay();
    updateProcessSaleButtonState();
};

window.removeFromCart = (productId) => {
    const itemIndex = saleCart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        saleCart[itemIndex].quantityInCart--;
        if (saleCart[itemIndex].quantityInCart === 0) {
            saleCart.splice(itemIndex, 1);
        }
    }
    updateCartDisplay();
    updateProcessSaleButtonState();
};

const updateCartDisplay = () => {
    const cartItemsDiv = document.getElementById('cart-items');
    const emptyCartMessage = document.getElementById('empty-cart-message');
    cartItemsDiv.innerHTML = '';
    emptyCartMessage.style.display = saleCart.length === 0 ? 'block' : 'none';
    let total = 0;
    saleCart.forEach(item => {
        total += item.sellPrice * item.quantityInCart;
        const itemDiv = document.createElement('div');
        itemDiv.className = "flex items-center justify-between bg-gray-900 p-3 rounded-md border border-gray-700";
        itemDiv.innerHTML = `
            <div><p class="font-medium text-gray-300">${item.name}</p><p class="text-sm text-gray-400">${item.quantityInCart} x ${formatCurrency(item.sellPrice)}</p></div>
            <div class="flex items-center space-x-2">
                <button onclick="window.removeFromCart('${item.id}')" class="p-1 bg-red-600 text-white rounded-full hover:bg-red-700"><i data-lucide="minus" style="width:16px;height:16px;"></i></button>
                <span class="font-semibold text-gray-300">${item.quantityInCart}</span>
                <button onclick="window.addToCart('${item.id}')" class="p-1 bg-green-600 text-white rounded-full hover:bg-green-700"><i data-lucide="plus" style="width:16px;height:16px;"></i></button>
            </div>`;
        cartItemsDiv.appendChild(itemDiv);
    });
    document.getElementById('cart-total').textContent = formatCurrency(total);
    lucide.createIcons();
};

window.updatePaymentType = (type) => {
    currentPaymentType = type;
    document.getElementById('customer-select-container').classList.toggle('hidden', currentPaymentType !== 'credit');
    document.getElementById('card-type-container').classList.toggle('hidden', currentPaymentType !== 'card');
    if (currentPaymentType !== 'credit') {
        selectedCustomerForSale = '';
        if(document.getElementById('sale-customer-select')) {
            document.getElementById('sale-customer-select').value = '';
        }
    }
    updateProcessSaleButtonState();
};

window.updateProcessSaleButtonState = () => {
    const btn = document.getElementById('process-sale-btn');
    if(!btn) return;
    let enabled = saleCart.length > 0;
    if (currentPaymentType === 'credit') {
        selectedCustomerForSale = document.getElementById('sale-customer-select').value;
        if (!selectedCustomerForSale) {
            enabled = false;
        }
    }
    btn.disabled = !enabled;
};

window.processSale = async () => {
    const saleError = document.getElementById('sale-error-message');
    const saleErrorText = document.getElementById('sale-error-text');
    saleError.classList.add('hidden');

    if (saleCart.length === 0) { return; }
    if (currentPaymentType === 'credit' && !selectedCustomerForSale) { return; }
    
    try {
        const totalAmount = saleCart.reduce((acc, item) => acc + (item.sellPrice * item.quantityInCart), 0);
        const transactionData = {
            type: 'sale', date: new Date().toISOString(),
            items: saleCart.map(item => ({ productId: item.id, productName: item.name, quantity: item.quantityInCart, pricePerUnit: item.sellPrice, totalPrice: item.sellPrice * item.quantityInCart })),
            totalAmount, paymentType: currentPaymentType,
            cardType: currentPaymentType === 'card' ? document.querySelector('input[name="cardType"]:checked').value : null,
            customerId: currentPaymentType === 'credit' ? selectedCustomerForSale : null,
            status: currentPaymentType === 'credit' ? 'pending' : 'paid',
        };
        await addDoc(collection(window.db, "transactions"), transactionData);

        const batch = writeBatch(window.db);
        saleCart.forEach(item => {
            const productRef = doc(window.db, "products", item.id);
            const newQuantity = item.quantity - item.quantityInCart;
            if (newQuantity < 0) throw new Error(`Estoque insuficiente para ${item.name}`);
            batch.update(productRef, { quantity: newQuantity });
        });
        await batch.commit();

        if (currentPaymentType === 'credit' && selectedCustomerForSale) {
            const customerRef = doc(window.db, "customers", selectedCustomerForSale);
            const customer = currentCustomers.find(c => c.id === selectedCustomerForSale);
            const newTotalDue = (customer.totalDue || 0) + totalAmount;
            await updateDoc(customerRef, { totalDue: newTotalDue });
        }
        
        saleCart = [];
        updateCartDisplay();
        updateProcessSaleButtonState();
        showModal('Venda Realizada!', 'A venda foi processada com sucesso!', () => hideModal());

    } catch (err) {
        console.error("Erro ao processar venda:", err);
        saleErrorText.textContent = `Erro: ${err.message}`;
        saleError.classList.remove('hidden');
    }
};

const loadProductsForSale = () => {
    onSnapshot(collection(window.db, "products"), (snapshot) => {
        if (!document.getElementById('available-products-list')) return;
        currentProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayAvailableProducts(currentProducts);
    }, (err) => console.error("Erro ao carregar produtos para venda:", err));
};

const displayAvailableProducts = (products) => {
    const list = document.getElementById('available-products-list');
    if (!list) return;
    list.innerHTML = '';
    const available = products.filter(p => p.quantity > 0);
    document.getElementById('no-available-products-message').classList.toggle('hidden', available.length > 0);
    available.forEach(product => {
        const card = document.createElement('div');
        card.className = "bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col justify-between";
        card.innerHTML = `
            <div>
                <p class="font-semibold text-lg text-gray-300">${product.name}</p>
                <p class="text-gray-400 text-sm">Estoque: ${product.quantity}</p>
                <p class="font-bold text-orange-400 text-xl">${formatCurrency(product.sellPrice)}</p>
            </div>
            <button onclick="window.addToCart('${product.id}')" class="mt-3 w-full px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 flex items-center justify-center text-sm shadow-orange"><i data-lucide="plus" class="mr-2"></i> Adicionar</button>`;
        list.appendChild(card);
    });
    lucide.createIcons();
};

const loadCustomersForSale = () => {
    onSnapshot(collection(window.db, "customers"), (snapshot) => {
        const select = document.getElementById('sale-customer-select');
        if (!select) return;
        const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Mantém a lista de clientes atualizada para outras partes do sistema
        currentCustomers = customers; 
        
        select.innerHTML = '<option value="">Selecione um cliente</option>';
        customers.forEach(customer => {
            select.innerHTML += `<option value="${customer.id}">${customer.name}</option>`;
        });
    }, (err) => console.error("Erro ao carregar clientes para venda:", err));
};

// --- Renderização da View de Dashboard ---
const renderDashboardView = async () => {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="bg-gray-900 rounded-lg border border-orange-600/50 shadow-neon p-6 mb-8">
            <h2 class="text-3xl font-chakra font-bold mb-6 text-orange-400 flex items-center"><i data-lucide="bar-chart-2" class="mr-3 text-orange-600"></i> Dashboard de Vendas</h2>
            <div class="mb-6 flex flex-wrap items-end gap-4">
                <div><label for="start-date" class="block text-sm font-medium text-gray-400">Data Inicial</label><input type="date" id="start-date" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2"></div>
                <div><label for="end-date" class="block text-sm font-medium text-gray-400">Data Final</label><input type="date" id="end-date" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2"></div>
                <button id="filter-dashboard-btn" class="px-4 py-2 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 transition-colors flex items-center justify-center shadow-orange"><i data-lucide="filter" class="mr-2"></i> Filtrar</button>
            </div>
            <div id="dashboard-cards" class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div class="bg-gray-800 p-6 rounded-lg border border-orange-600/50 flex items-center"><i data-lucide="dollar-sign" class="text-green-500 mr-4" style="width: 32px; height: 32px;"></i><div><p class="text-lg text-gray-400">Total de Vendas</p><p id="total-sales" class="text-3xl font-bold text-green-400">Carregando...</p></div></div>
                <div class="bg-gray-800 p-6 rounded-lg border border-orange-600/50 flex items-center"><i data-lucide="alert-circle" class="text-red-500 mr-4" style="width: 32px; height: 32px;"></i><div><p class="text-lg text-gray-400">Dívida Total de Clientes</p><p id="total-debt" class="text-3xl font-bold text-red-400">Carregando...</p></div></div>
            </div>
            <h3 class="text-2xl font-chakra font-semibold mb-4 text-orange-400 flex items-center"><i data-lucide="receipt" class="mr-2 text-orange-600" style="width: 20px; height: 20px;"></i> Últimas Transações</h3>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-700 rounded-lg overflow-hidden border border-gray-700">
                    <thead class="bg-gray-800"><tr><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tipo</th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Descrição</th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Valor</th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Data</th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th></tr></thead>
                    <tbody id="transactions-table-body" class="bg-gray-900 divide-y divide-gray-700"></tbody>
                </table>
                <p id="no-transactions-message" class="px-6 py-4 text-center text-sm text-gray-500 hidden">Nenhuma transação registrada.</p>
            </div>
        </div>
    `;
    lucide.createIcons();
    document.getElementById('filter-dashboard-btn').addEventListener('click', loadDashboardData);
    loadDashboardData();
};

const loadDashboardData = async () => {
    if (!window.db) return;
    try {
        const customersSnapshot = await getDocs(collection(window.db, "customers"));
        let totalDebtAmount = 0;
        customersSnapshot.forEach(doc => { totalDebtAmount += doc.data().totalDue || 0; });
        document.getElementById('total-debt').textContent = formatCurrency(totalDebtAmount);

        let transactionsQuery = query(collection(window.db, "transactions"));
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        if (startDate) transactionsQuery = query(transactionsQuery, where('date', '>=', `${startDate}T00:00:00.000Z`));
        if (endDate) transactionsQuery = query(transactionsQuery, where('date', '<=', `${endDate}T23:59:59.999Z`));
        
        const transactionsSnapshot = await getDocs(transactionsQuery);
        let totalSalesAmount = 0;
        let transactions = transactionsSnapshot.docs.map(doc => {
            const data = doc.data();
            if (data.type === 'sale') totalSalesAmount += data.totalAmount || 0;
            return { id: doc.id, ...data };
        });
        document.getElementById('total-sales').textContent = formatCurrency(totalSalesAmount);
        
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        const tableBody = document.getElementById('transactions-table-body');
        const noTransactionsMessage = document.getElementById('no-transactions-message');
        tableBody.innerHTML = '';
        noTransactionsMessage.classList.toggle('hidden', transactions.length > 0);
        
        transactions.slice(0, 10).forEach(transaction => {
            const row = tableBody.insertRow();
            let description = '';
            if (transaction.type === 'sale') {
                const customer = currentCustomers.find(c=>c.id === transaction.customerId);
                description = `Venda para ${customer ? customer.name : (transaction.paymentType === 'cash' ? 'À Vista' : 'Cliente Removido')}`;
            } else if (transaction.type === 'payment') {
                description = `Pagamento de ${transaction.customerName || 'Cliente Removido'}`;
            }
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm capitalize">${transaction.type === 'sale' ? 'Venda' : 'Pagamento'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${description}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${transaction.type === 'sale' ? 'text-orange-400' : 'text-green-400'}">${formatCurrency(transaction.amount || transaction.totalAmount || 0)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${new Date(transaction.date).toLocaleString('pt-BR')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm capitalize">${transaction.status || 'Pago'}</td>
            `;
        });
    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
    }
};
