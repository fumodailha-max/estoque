// Importa os módulos do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variáveis globais
window.firebaseApp = null;
window.db = null;
window.auth = null;
window.currentUser = { uid: null, role: null };

// Variáveis de estado
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

// ... (O resto do seu código, começando com handleLoginForm, continua o mesmo)
// --- Funções de Autenticação e Lógica de Páginas ---
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

window.handleSignOut = () => signOut(window.auth).catch(console.error);

document.addEventListener('DOMContentLoaded', () => {
    initFirebaseAndAuth();
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLoginForm);
    if (typeof lucide !== 'undefined') lucide.createIcons();
});

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

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
    confirmBtn.onclick = () => { hideModal(); if (onConfirm) onConfirm(); };
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

// --- Funções de Produtos (CRUD) ---
const deleteProduct = async (productId) => {
    try {
        await deleteDoc(doc(window.db, "products", productId)); // CAMINHO ALTERADO
        showModal('Sucesso!', 'Produto excluído com sucesso.', () => {});
    } catch (err) {
        console.error("Erro ao excluir produto:", err);
        showModal('Erro!', 'Erro ao excluir produto. Tente novamente.', null, () => {});
    }
};
window.confirmDeleteProduct = (productId, productName) => showModal('Confirmar Exclusão', `Tem certeza que deseja excluir o produto "${productName}"?`, () => deleteProduct(productId), () => {}, 'Excluir', 'Cancelar');

// --- Funções de Clientes (CRUD - Continua privado) ---
const deleteCustomer = async (customerId) => {
    try {
        await deleteDoc(doc(window.db, `users/${window.currentUser.uid}/customers`, customerId));
        showModal('Sucesso!', 'Cliente excluído com sucesso.', () => {});
    } catch (err) {
        console.error("Erro ao excluir cliente:", err);
        showModal('Erro!', 'Erro ao excluir cliente. Tente novamente.', null, () => {});
    }
};
window.confirmDeleteCustomer = (customerId, customerName) => showModal('Confirmar Exclusão', `Tem certeza que deseja excluir o cliente "${customerName}"?`, () => deleteCustomer(customerId), () => {}, 'Excluir', 'Cancelar');

const handlePay = async () => {
    // ... (Esta função continua igual, pois mexe com dados privados do usuário)
};
window.openPayModal = (customerId) => {
    // ... (Esta função continua igual)
};


// --- Renderização da View de Estoque ---
const renderEstoqueView = () => {
    // ... (A estrutura HTML da view continua a mesma)
};

const loadProducts = () => {
    if (!window.db) return;
    const productsCollectionRef = collection(window.db, "products"); // CAMINHO ALTERADO
    onSnapshot(productsCollectionRef, (snapshot) => {
        currentProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayProducts(currentProducts);
    }, (err) => console.error("Erro ao carregar produtos:", err));
};

const displayProducts = (products) => {
    // ... (Esta função continua igual)
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
            await updateDoc(doc(window.db, "products", productId), productData); // CAMINHO ALTERADO
            showModal('Sucesso!', `O produto "${productData.name}" foi atualizado.`, () => {});
        } else {
            await addDoc(collection(window.db, "products"), productData); // CAMINHO ALTERADO
            showModal('Sucesso!', `O produto "${productData.name}" foi adicionado.`, () => {});
        }
        cancelEditProduct();
    } catch (err) {
        console.error("Erro ao salvar produto:", err);
        errorMessage.textContent = "Erro ao salvar produto. Tente novamente.";
        errorMessage.classList.remove('hidden');
    }
};

const cancelEditProduct = () => {
    // ... (Esta função continua igual)
};
window.editProduct = (productId) => {
    // ... (Esta função continua igual)
};

// --- O RESTANTE DO CÓDIGO (Clientes, Vendas, Dashboard) ---
// ... (Cole o restante do seu script.js aqui, as funções não precisam de mais alterações)
