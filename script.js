// Importa os módulos do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variáveis globais para Firebase e estado do usuário
window.firebaseApp = null;
window.db = null;
window.auth = null;
window.currentUser = { uid: null, role: null };
window.appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Variáveis de estado do aplicativo
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
        const config = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
        window.firebaseApp = initializeApp(config);
        window.db = getFirestore(window.firebaseApp);
        window.auth = getAuth(window.firebaseApp);

        onAuthStateChanged(window.auth, async (user) => {
            const isLoginPage = window.location.pathname.endsWith('login.html');

            if (user) {
                // --- USUÁRIO ESTÁ LOGADO ---
                const userRef = doc(window.db, `users`, user.uid);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                    window.currentUser.uid = user.uid;
                    window.currentUser.role = userSnap.data().role;
                    console.log("Role do usuário:", window.currentUser.role);
                    
                    // Se o usuário logado estiver na página de login, o enviamos para o sistema.
                    if (isLoginPage) {
                        window.location.href = 'index.html';
                    } else {
                        // Se ele já estiver no sistema, carregamos a primeira página (Estoque).
                        loadPage('estoque');
                    }
                } else {
                    console.log("Nenhum documento de usuário encontrado. Saindo.");
                    signOut(window.auth);
                }

            } else {
                // --- USUÁRIO ESTÁ DESLOGADO ---
                window.currentUser.uid = null;
                window.currentUser.role = null;
                
                // Se o usuário deslogado NÃO estiver na página de login, forçamos o redirecionamento para ela.
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
        // O onAuthStateChanged irá cuidar do redirecionamento após o login.
    } catch (error) {
        let message = "Erro ao fazer login. Tente novamente.";
        if (error.code === 'auth/invalid-email' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            message = "E-mail ou senha inválidos.";
        }
        errorMessageElem.textContent = message;
        errorMessageElem.classList.remove('hidden');
        console.error("Erro de login:", error);
    }
};

// **NOVA FUNÇÃO** Para fazer logout
window.handleSignOut = () => {
    signOut(window.auth).catch((error) => {
        console.error("Erro ao fazer logout:", error);
    });
};

// Garante que o DOM esteja totalmente carregado
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa o Firebase
    initFirebaseAndAuth();

    // Adiciona o event listener para o formulário de login, se ele existir na página
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginForm);
    }

    // Inicializa os ícones Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});

// Helper para formatar moeda
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// --- Funções de Modal Customizado ---
const showModal = (title, message, onConfirm, onCancel = null, confirmText = 'Confirmar', cancelText = 'Cancelar', contentHtml = '') => {
    const modal = document.getElementById('custom-modal');
    if (!modal) return;
    document.getElementById('modal-title').innerHTML = `<i data-lucide="info" class="mr-2 text-blue-500" style="width: 24px; height: 24px;"></i> ${title}`;
    document.getElementById('modal-message').innerHTML = message;
    document.getElementById('modal-content-area').innerHTML = contentHtml; // Adiciona conteúdo HTML dinâmico
    lucide.createIcons(); // Recria os ícones Lucide no modal

    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    confirmBtn.textContent = confirmText;
    confirmBtn.onclick = () => {
        hideModal();
        if (onConfirm) onConfirm();
    };

    if (onCancel) {
        cancelBtn.style.display = 'inline-block';
        cancelBtn.textContent = cancelText;
        cancelBtn.onclick = () => {
            hideModal();
            onCancel();
        };
    } else {
        cancelBtn.style.display = 'none';
    }

    modal.classList.remove('hidden');
};

const hideModal = () => {
    const modal = document.getElementById('custom-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('modal-content-area').innerHTML = ''; // Limpa o conteúdo dinâmico
    }
};


// --- Gerenciamento de Páginas ---
window.loadPage = (pageName) => {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.innerHTML = 'Carregando...'; // Limpa o conteúdo atual

    // Verifica se a página solicitada é o Dashboard e se o usuário tem permissão
    if (pageName === 'dashboard' && window.currentUser.role !== 'admin') {
        mainContent.innerHTML = `<div class="bg-gray-800 rounded-lg p-8 text-center mt-12">
            <h2 class="text-3xl font-bold text-red-500 mb-4">Acesso Negado</h2>
            <p class="text-gray-400">Você não tem permissão para acessar o Dashboard.</p>
        </div>`;
        // Remove a classe 'nav-active' de todos os botões, mas não ativa nenhum
        document.querySelectorAll('nav button').forEach(btn => {
            btn.classList.remove('nav-active');
        });
        document.getElementById(`nav-${pageName}`).classList.add('nav-active'); // Marca o dashboard mesmo assim
        return;
    }

    // Remove a classe 'nav-active' de todos os botões e adiciona ao botão clicado
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('nav-active');
    });
    const activeButton = document.getElementById(`nav-${pageName}`);
    if(activeButton) activeButton.classList.add('nav-active');


    switch (pageName) {
        case 'estoque':
            renderEstoqueView();
            break;
        case 'clientes':
            renderClientesView();
            break;
        case 'vendas':
            renderVendasView();
            break;
        case 'dashboard':
            renderDashboardView();
            break;
        default:
            mainContent.innerHTML = `<div class="text-center text-lg mt-8 text-gray-600">Página não encontrada.</div>`;
    }
};

// --- Funções globais para Produtos ---
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

window.confirmDeleteProduct = (productId, productName) => {
    showModal('Confirmar Exclusão',
              `Tem certeza que deseja excluir o produto "${productName}"? Esta ação não pode ser desfeita.`,
              () => deleteProduct(productId),
              () => {}, // Não faz nada ao cancelar
              'Excluir', 'Cancelar');
};

const deleteProduct = async (productId) => {
    try {
        await deleteDoc(doc(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/products`, productId));
        console.log("Produto excluído com sucesso!");
        showModal('Sucesso!', 'Produto excluído com sucesso.', () => {});
    } catch (err) {
        console.error("Erro ao excluir produto:", err);
        showModal('Erro!', 'Erro ao excluir produto. Tente novamente.', null, () => {});
    }
};

// --- Funções globais para Clientes ---
window.editCustomer = (customerId) => {
    const customer = currentCustomers.find(c => c.id === customerId);
    if (customer) {
        document.getElementById('customer-id').value = customer.id;
        document.getElementById('customer-name').value = customer.name;
        document.getElementById('customer-phone').value = customer.phone;
        document.getElementById('customer-submit-btn').innerHTML = `<i data-lucide="check-circle" class="mr-2"></i> Atualizar Cliente`;
        document.getElementById('customer-cancel-edit-btn').classList.remove('hidden');
        lucide.createIcons();
    }
};

window.confirmDeleteCustomer = (customerId, customerName) => {
    showModal('Confirmar Exclusão',
              `Tem certeza que deseja excluir o cliente "${customerName}"? Esta ação não pode ser desfeita.`,
              () => deleteCustomer(customerId),
              () => {},
              'Excluir', 'Cancelar');
};

const deleteCustomer = async (customerId) => {
    try {
        await deleteDoc(doc(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/customers`, customerId));
        console.log("Cliente excluído com sucesso!");
        showModal('Sucesso!', 'Cliente excluído com sucesso.', () => {});
    } catch (err) {
        console.error("Erro ao excluir cliente:", err);
        showModal('Erro!', 'Erro ao excluir cliente. Tente novamente.', null, () => {});
    }
};

window.openPayModal = (customerId) => {
    const customer = currentCustomers.find(c => c.id === customerId);
    if (!customer) return;

    customerToPayId = customerId; // Armazena o ID do cliente globalmente
    const contentHtml = `
        <p class="mb-2">Dívida atual: <span class="font-semibold text-orange-400">${formatCurrency(customer.totalDue || 0)}</span></p>
        <label for="payment-amount" class="block text-sm font-medium text-gray-400 mb-1">Valor do Pagamento (R$)</label>
        <input
            type="number"
            id="payment-amount"
            step="0.01"
            class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-green-500 focus:ring-green-500 p-2"
            required
            max="${customer.totalDue}"
        />
        <p id="payment-error-message" class="text-red-500 text-xs mt-2 hidden"></p>
    `;

    showModal(
        `Registrar Pagamento para ${customer.name}`,
        '', // Mensagem principal vazia, pois o conteúdo é dinâmico
        handlePay,
        () => { customerToPayId = null; },
        'Registrar Pagamento',
        'Cancelar',
        contentHtml
    );
};

const handlePay = async () => {
    const paymentAmountInput = document.getElementById('payment-amount');
    const paymentAmount = parseFloat(paymentAmountInput.value);
    const paymentErrorMessage = document.getElementById('payment-error-message');
    paymentErrorMessage.classList.add('hidden');

    const customer = currentCustomers.find(c => c.id === customerToPayId);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
        paymentErrorMessage.textContent = "O valor do pagamento deve ser um número positivo.";
        paymentErrorMessage.classList.remove('hidden');
        return;
    }
    if (paymentAmount > customer.totalDue) {
        paymentErrorMessage.textContent = "O valor do pagamento não pode ser maior que a dívida total.";
        paymentErrorMessage.classList.remove('hidden');
        return;
    }

    try {
        const newTotalDue = (customer.totalDue || 0) - paymentAmount;
        const customerRef = doc(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/customers`, customerToPayId);
        await updateDoc(customerRef, { totalDue: newTotalDue });

        await addDoc(collection(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/transactions`), {
            type: 'payment',
            customerId: customerToPayId,
            customerName: customer.name,
            amount: paymentAmount,
            date: new Date().toISOString(),
        });

        console.log("Pagamento registrado com sucesso!");
        showModal('Sucesso!', 'Pagamento registrado com sucesso!', () => {});
        customerToPayId = null;
    } catch (err) {
        console.error("Erro ao registrar pagamento:", err);
        showModal('Erro!', 'Erro ao registrar pagamento. Tente novamente.', null, () => {});
    }
};

// --- Renderização da View de Estoque ---
const renderEstoqueView = () => {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="bg-gray-900 rounded-lg border border-orange-600/50 shadow-neon p-6 mb-8">
            <h2 class="text-3xl font-chakra font-bold mb-6 text-orange-400 flex items-center">
                <i data-lucide="package" class="mr-3 text-orange-600"></i> Gerenciar Estoque
            </h2>

            <div class="mb-6">
                <label for="product-search" class="sr-only">Pesquisar produtos</label>
                <div class="relative">
                    <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <i data-lucide="search" class="w-5 h-5 text-gray-500"></i>
                    </div>
                    <input type="text" id="product-search" placeholder="Pesquisar por nome do produto..." class="block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2 pl-10">
                </div>
            </div>

            <form id="product-form" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8 p-4 bg-gray-800 rounded-lg border-2 border-gray-700">
                <input type="hidden" id="product-id">
                <div class="col-span-1 md:col-span-2 lg:col-span-1">
                    <label for="product-name" class="block text-sm font-medium text-gray-400">Nome do Produto</label>
                    <input type="text" id="product-name" name="name" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2" required>
                </div>
                <div>
                    <label for="product-barcode" class="block text-sm font-medium text-gray-400">Código de Barras</label>
                    <input type="text" id="product-barcode" name="barcode" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2">
                </div>
                <div>
                    <label for="product-quantity" class="block text-sm font-medium text-gray-400">Quantidade</label>
                    <input type="number" id="product-quantity" name="quantity" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2" required>
                </div>
                <div>
                    <label for="product-cost-price" class="block text-sm font-medium text-gray-400">Preço de Custo (R$)</label>
                    <input type="number" id="product-cost-price" name="costPrice" step="0.01" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2" required>
                </div>
                <div>
                    <label for="product-sell-price" class="block text-sm font-medium text-gray-400">Preço de Venda (R$)</label>
                    <input type="number" id="product-sell-price" name="sellPrice" step="0.01" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2" required>
                </div>
                <div class="col-span-full lg:col-span-1 flex items-end justify-end space-x-2">
                    <button type="submit" id="product-submit-btn" class="w-full lg:w-auto px-4 py-2 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 transition-colors flex items-center justify-center shadow-orange">
                        <i data-lucide="plus" class="mr-2"></i> Adicionar Produto
                    </button>
                    <button type="button" id="product-cancel-edit-btn" class="hidden w-full lg:w-auto px-4 py-2 bg-gray-400 text-white font-medium rounded-md hover:bg-gray-500 transition-colors flex items-center justify-center">
                        <i data-lucide="x-circle" class="mr-2"></i> Cancelar
                    </button>
                </div>
            </form>

            <div id="product-error-message" class="text-red-500 text-center mb-4 hidden"></div>

            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-700 rounded-lg overflow-hidden border border-gray-700">
                    <thead class="bg-gray-800">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Produto
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Código de Barras
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Quantidade
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Custo
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Venda
                            </th>
                            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody id="products-table-body" class="bg-gray-900 divide-y divide-gray-700">
                        </tbody>
                </table>
                <p id="no-products-message" class="px-6 py-4 text-center text-sm text-gray-500 hidden">Nenhum produto cadastrado.</p>
            </div>
        </div>
    `;
    lucide.createIcons(); // Inicializa os ícones Lucide para esta view

    // Adiciona event listeners para o formulário de produto
    document.getElementById('product-form').addEventListener('submit', handleProductSubmit);
    document.getElementById('product-cancel-edit-btn').addEventListener('click', cancelEditProduct);
    document.getElementById('product-search').addEventListener('input', (e) => {
        const searchTerm = e.target.value;
        const filteredProducts = currentProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
        displayProducts(filteredProducts);
    });

    // Carrega e exibe os produtos
    loadProducts();
};

const loadProducts = () => {
    if (!window.db || !window.currentUser.uid) {
        document.getElementById('products-table-body').innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-red-500">Firebase não inicializado ou usuário não autenticado.</td></tr>`;
        return;
    }

    const productsCollectionRef = collection(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/products`);
    onSnapshot(productsCollectionRef, (snapshot) => {
        const productsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        currentProducts = productsData;
        displayProducts(productsData);
    }, (err) => {
        console.error("Erro ao carregar produtos:", err);
        document.getElementById('product-error-message').textContent = "Erro ao carregar produtos. Tente novamente mais tarde.";
        document.getElementById('product-error-message').classList.remove('hidden');
    });
};

const displayProducts = (products) => {
    const tableBody = document.getElementById('products-table-body');
    tableBody.innerHTML = '';
    const noProductsMessage = document.getElementById('no-products-message');

    if (products.length === 0) {
        noProductsMessage.classList.remove('hidden');
        return;
    } else {
        noProductsMessage.classList.add('hidden');
    }

    products.forEach(product => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-300">${product.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${product.barcode || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${product.quantity}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${formatCurrency(product.costPrice)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${formatCurrency(product.sellPrice)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button onclick="window.editProduct('${product.id}')" class="text-blue-400 hover:text-blue-500 transition-colors">Editar</button>
                <button onclick="window.confirmDeleteProduct('${product.id}', '${product.name}')" class="text-red-400 hover:text-red-500 transition-colors">Excluir</button>
            </td>
        `;
    });
};

const handleProductSubmit = async (event) => {
    event.preventDefault();
    document.getElementById('product-error-message').classList.add('hidden');

    const productId = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value;
    const barcode = document.getElementById('product-barcode').value;
    const quantity = parseInt(document.getElementById('product-quantity').value);
    const costPrice = parseFloat(document.getElementById('product-cost-price').value);
    const sellPrice = parseFloat(document.getElementById('product-sell-price').value);

    if (!name || isNaN(quantity) || isNaN(costPrice) || isNaN(sellPrice)) {
        document.getElementById('product-error-message').textContent = "Por favor, preencha todos os campos corretamente.";
        document.getElementById('product-error-message').classList.remove('hidden');
        return;
    }

    const productData = { name: name.trim(), barcode: barcode.trim(), quantity, costPrice, sellPrice };

    try {
        if (productId) {
            // Editando produto
            const productRef = doc(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/products`, productId);
            await updateDoc(productRef, productData);
            console.log("Produto atualizado com sucesso!");
            showModal('Sucesso!', `O produto "${name}" foi atualizado com sucesso.`, () => {});
        } else {
            // Adicionando novo produto
            await addDoc(collection(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/products`), productData);
            console.log("Produto adicionado com sucesso!");
            showModal('Sucesso!', `O produto "${name}" foi adicionado ao estoque.`, () => {});
        }
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = '';
        document.getElementById('product-submit-btn').innerHTML = `<i data-lucide="plus" class="mr-2"></i> Adicionar Produto`;
        document.getElementById('product-cancel-edit-btn').classList.add('hidden');
        lucide.createIcons();
    } catch (err) {
        console.error("Erro ao salvar produto:", err);
        document.getElementById('product-error-message').textContent = "Erro ao salvar produto. Verifique os dados e tente novamente.";
        document.getElementById('product-error-message').classList.remove('hidden');
    }
};

const cancelEditProduct = () => {
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-submit-btn').innerHTML = `<i data-lucide="plus" class="mr-2"></i> Adicionar Produto`;
    document.getElementById('product-cancel-edit-btn').classList.add('hidden');
    lucide.createIcons();
};


// --- Renderização da View de Clientes ---
const renderClientesView = () => {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="bg-gray-900 rounded-lg border border-orange-600/50 shadow-neon p-6 mb-8">
            <h2 class="text-3xl font-chakra font-bold mb-6 text-orange-400 flex items-center">
                <i data-lucide="users" class="mr-3 text-orange-600"></i> Gerenciar Clientes
            </h2>

            <form id="customer-form" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 p-4 bg-gray-800 rounded-lg border-2 border-gray-700">
                <input type="hidden" id="customer-id">
                <div class="col-span-1 md:col-span-1">
                    <label for="customer-name" class="block text-sm font-medium text-gray-400">Nome do Cliente</label>
                    <input type="text" id="customer-name" name="name" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2" required>
                </div>
                <div>
                    <label for="customer-phone" class="block text-sm font-medium text-gray-400">Telefone</label>
                    <input type="text" id="customer-phone" name="phone" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2">
                </div>
                <div class="col-span-full md:col-span-1 flex items-end justify-end space-x-2">
                    <button type="submit" id="customer-submit-btn" class="w-full md:w-auto px-4 py-2 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 transition-colors flex items-center justify-center shadow-orange">
                        <i data-lucide="plus" class="mr-2"></i> Adicionar Cliente
                    </button>
                    <button type="button" id="customer-cancel-edit-btn" class="hidden w-full md:w-auto px-4 py-2 bg-gray-400 text-white font-medium rounded-md hover:bg-gray-500 transition-colors flex items-center justify-center">
                        <i data-lucide="x-circle" class="mr-2"></i> Cancelar
                    </button>
                </div>
            </form>

            <div id="customer-error-message" class="text-red-500 text-center mb-4 hidden"></div>

            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-700 rounded-lg overflow-hidden border border-gray-700">
                    <thead class="bg-gray-800">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Nome
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Telefone
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Dívida Total
                            </th>
                            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody id="customers-table-body" class="bg-gray-900 divide-y divide-gray-700">
                        </tbody>
                </table>
                <p id="no-customers-message" class="px-6 py-4 text-center text-sm text-gray-500 hidden">Nenhum cliente cadastrado.</p>
            </div>
        </div>
    `;
    lucide.createIcons();

    document.getElementById('customer-form').addEventListener('submit', handleCustomerSubmit);
    document.getElementById('customer-cancel-edit-btn').addEventListener('click', cancelEditCustomer);

    loadCustomers();
};

const loadCustomers = () => {
    if (!window.db || !window.currentUser.uid) {
        document.getElementById('customers-table-body').innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-sm text-red-500">Firebase não inicializado ou usuário não autenticado.</td></tr>`;
        return;
    }

    const customersCollectionRef = collection(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/customers`);
    onSnapshot(customersCollectionRef, (snapshot) => {
        const customersData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        currentCustomers = customersData;
        displayCustomers(customersData);
    }, (err) => {
        console.error("Erro ao carregar clientes:", err);
        document.getElementById('customer-error-message').textContent = "Erro ao carregar clientes. Tente novamente mais tarde.";
        document.getElementById('customer-error-message').classList.remove('hidden');
    });
};

const displayCustomers = (customers) => {
    const tableBody = document.getElementById('customers-table-body');
    tableBody.innerHTML = '';
    const noCustomersMessage = document.getElementById('no-customers-message');

    if (customers.length === 0) {
        noCustomersMessage.classList.remove('hidden');
        return;
    } else {
        noCustomersMessage.classList.add('hidden');
    }

    customers.forEach(customer => {
        const row = tableBody.insertRow();
        const totalDue = customer.totalDue || 0;
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-300">${customer.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${customer.phone || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                <span class="font-semibold ${totalDue > 0 ? 'text-orange-400' : 'text-green-400'}">
                    ${formatCurrency(totalDue)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button onclick="window.openPayModal('${customer.id}')" class="text-green-400 hover:text-green-500 transition-colors mr-2" ${totalDue <= 0 ? 'disabled' : ''}>Pagar</button>
                <button onclick="window.editCustomer('${customer.id}')" class="text-blue-400 hover:text-blue-500 transition-colors mr-2">Editar</button>
                <button onclick="window.confirmDeleteCustomer('${customer.id}', '${customer.name}')" class="text-red-400 hover:text-red-500 transition-colors">Excluir</button>
            </td>
        `;
    });
};

const handleCustomerSubmit = async (event) => {
    event.preventDefault();
    document.getElementById('customer-error-message').classList.add('hidden');

    const customerId = document.getElementById('customer-id').value;
    const name = document.getElementById('customer-name').value;
    const phone = document.getElementById('customer-phone').value;

    if (!name) {
        document.getElementById('customer-error-message').textContent = "Por favor, preencha o nome do cliente.";
        document.getElementById('customer-error-message').classList.remove('hidden');
        return;
    }

    const customerData = {
        name: name.trim(),
        phone: phone.trim(),
        totalDue: customerId ? (currentCustomers.find(c => c.id === customerId)?.totalDue || 0) : 0,
    };

    try {
        if (customerId) {
            const customerRef = doc(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/customers`, customerId);
            await updateDoc(customerRef, customerData);
            console.log("Cliente atualizado com sucesso!");
            showModal('Sucesso!', `O cliente "${name}" foi atualizado com sucesso.`, () => {});
        } else {
            await addDoc(collection(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/customers`), customerData);
            console.log("Cliente adicionado com sucesso!");
            showModal('Sucesso!', `O cliente "${name}" foi adicionado.`, () => {});
        }
        document.getElementById('customer-form').reset();
        document.getElementById('customer-id').value = '';
        document.getElementById('customer-submit-btn').innerHTML = `<i data-lucide="plus" class="mr-2"></i> Adicionar Cliente`;
        document.getElementById('customer-cancel-edit-btn').classList.add('hidden');
        lucide.createIcons();
    } catch (err) {
        console.error("Erro ao salvar cliente:", err);
        document.getElementById('customer-error-message').textContent = "Erro ao salvar cliente. Verifique os dados e tente novamente.";
        document.getElementById('customer-error-message').classList.remove('hidden');
    }
};

const cancelEditCustomer = () => {
    document.getElementById('customer-form').reset();
    document.getElementById('customer-id').value = '';
    document.getElementById('customer-submit-btn').innerHTML = `<i data-lucide="plus" class="mr-2"></i> Adicionar Cliente`;
    document.getElementById('customer-cancel-edit-btn').classList.add('hidden');
    lucide.createIcons();
};


// --- Renderização da View de Vendas ---
const renderVendasView = () => {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="bg-gray-900 rounded-lg border border-orange-600/50 shadow-neon p-6 mb-8">
            <h2 class="text-3xl font-chakra font-bold mb-6 text-orange-400 flex items-center">
                <i data-lucide="shopping-cart" class="mr-3 text-orange-600"></i> Realizar Venda
            </h2>

            <div id="sale-error-message" class="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-md relative mb-4 hidden" role="alert">
                <strong class="font-bold">Erro!</strong>
                <span id="sale-error-text" class="block sm:inline ml-2"></span>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2">
                    <div class="mb-4">
                        <label for="barcode-scanner" class="block text-sm font-medium text-gray-400">Ler Código de Barras</label>
                        <div class="relative mt-1">
                            <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <i data-lucide="scan" class="w-5 h-5 text-gray-500"></i>
                            </div>
                            <input type="text" id="barcode-scanner" placeholder="Posicione o cursor e escaneie o produto..." class="block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2 pl-10">
                        </div>
                    </div>
                    <h3 class="text-2xl font-chakra font-semibold mb-4 text-orange-400 flex items-center">
                        <i data-lucide="package" class="mr-2 text-orange-600" style="width: 20px; height: 20px;"></i> Produtos
                    </h3>
                    <div id="available-products-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-96 overflow-y-auto pr-2 custom-scrollbar">
                        </div>
                    <p id="no-available-products-message" class="col-span-full text-center text-gray-500 py-8 hidden">Nenhum produto disponível em estoque.</p>
                </div>

                <div class="lg:col-span-1 bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h3 class="text-2xl font-chakra font-semibold mb-4 text-orange-400 flex items-center">
                        <i data-lucide="shopping-cart" class="mr-2 text-orange-600" style="width: 20px; height: 20px;"></i> Carrinho
                    </h3>
                    <div id="cart-items" class="space-y-3 mb-6 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        </div>
                    <p id="empty-cart-message" class="text-gray-500 text-center py-4 hidden">Carrinho vazio.</p>

                    <div class="border-t border-gray-700 pt-4 mt-4">
                        <p class="text-xl font-bold text-gray-300 flex justify-between items-center">
                            Total: <span id="cart-total" class="text-orange-400">R$ 0,00</span>
                        </p>
                    </div>

                    <div class="mt-6 space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-400 mb-2">Tipo de Pagamento</label>
                            <div class="flex flex-wrap gap-4">
                                <label class="flex items-center">
                                    <input type="radio" name="paymentType" value="cash" checked class="form-radio text-orange-600 bg-gray-700" onchange="window.updatePaymentType(this.value)">
                                    <span class="ml-2 text-gray-300">À Vista</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="radio" name="paymentType" value="card" class="form-radio text-orange-600 bg-gray-700" onchange="window.updatePaymentType(this.value)">
                                    <span class="ml-2 text-gray-300">Cartão</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="radio" name="paymentType" value="credit" class="form-radio text-orange-600 bg-gray-700" onchange="window.updatePaymentType(this.value)">
                                    <span class="ml-2 text-gray-300">Na Nota (a prazo)</span>
                                </label>
                            </div>
                        </div>

                        <div id="customer-select-container" class="hidden">
                            <label for="sale-customer-select" class="block text-sm font-medium text-gray-400 mb-2">Selecionar Cliente</label>
                            <select id="sale-customer-select" class="block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2" required>
                                <option value="">Selecione um cliente</option>
                                </select>
                        </div>
                         <div id="card-type-container" class="hidden">
                            <label class="block text-sm font-medium text-gray-400 mb-2">Tipo de Cartão</label>
                            <div class="flex space-x-4">
                                <label class="flex items-center">
                                    <input type="radio" name="cardType" value="debit" checked class="form-radio text-orange-600 bg-gray-700">
                                    <span class="ml-2 text-gray-300">Débito</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="radio" name="cardType" value="credit" class="form-radio text-orange-600 bg-gray-700">
                                    <span class="ml-2 text-gray-300">Crédito</span>
                                </label>
                            </div>
                        </div>


                        <button id="process-sale-btn" onclick="window.processSale()" class="w-full px-4 py-3 bg-orange-600 text-white font-bold rounded-md hover:bg-orange-700 transition-colors flex items-center justify-center text-lg shadow-orange" disabled>
                            <i data-lucide="dollar-sign" class="mr-2" style="width: 20px; height: 20px;"></i> Processar Venda
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();

    // Carrega produtos e clientes para a tela de vendas
    loadProductsForSale();
    loadCustomersForSale();

    // Event listener para seleção de cliente
    document.getElementById('sale-customer-select').addEventListener('change', updateProcessSaleButtonState);
    document.querySelectorAll('input[name="paymentType"]').forEach(radio => {
        radio.addEventListener('change', window.updatePaymentType);
    });

    // Event listener para o campo de código de barras
    document.getElementById('barcode-scanner').addEventListener('change', handleBarcodeScan);

    updatePaymentType(currentPaymentType); // Inicializa a UI
};

const handleBarcodeScan = (event) => {
    const barcode = event.target.value.trim();
    if (barcode) {
        const product = currentProducts.find(p => p.barcode === barcode);
        if (product) {
            window.addToCart(product.id);
        } else {
            showModal('Produto não encontrado', `Nenhum produto com o código de barras "${barcode}" foi encontrado.`, () => {});
        }
        event.target.value = ''; // Limpa o campo após o escaneamento
    }
};

window.addToCart = (productId) => { // Tornada global
    document.getElementById('sale-error-message').classList.add('hidden');
    const product = currentProducts.find(p => p.id === productId);
    if (!product) return;

    const existingItemIndex = saleCart.findIndex(item => item.id === productId);

    if (existingItemIndex > -1) {
        // Produto já no carrinho
        const itemInCart = saleCart[existingItemIndex];
        if (itemInCart.quantityInCart >= product.quantity) {
            document.getElementById('sale-error-text').textContent = `Não há estoque suficiente para ${product.name}.`;
            document.getElementById('sale-error-message').classList.remove('hidden');
            return;
        }
        saleCart[existingItemIndex].quantityInCart++;
    } else {
        // Novo produto no carrinho
        if (product.quantity <= 0) {
            document.getElementById('sale-error-text').textContent = `O produto ${product.name} está fora de estoque.`;
            document.getElementById('sale-error-message').classList.remove('hidden');
            return;
        }
        saleCart.push({ ...product, quantityInCart: 1 });
    }
    updateCartDisplay();
    window.updateProcessSaleButtonState();
};

window.removeFromCart = (productId) => { // Tornada global
    document.getElementById('sale-error-message').classList.add('hidden');
    const existingItemIndex = saleCart.findIndex(item => item.id === productId);

    if (existingItemIndex > -1) {
        if (saleCart[existingItemIndex].quantityInCart > 1) {
            saleCart[existingItemIndex].quantityInCart--;
        } else {
            saleCart.splice(existingItemIndex, 1); // Remove o item se a quantidade for 1
        }
    }
    updateCartDisplay();
    window.updateProcessSaleButtonState();
};

const updateCartDisplay = () => {
    const cartItemsDiv = document.getElementById('cart-items');
    cartItemsDiv.innerHTML = '';
    const emptyCartMessage = document.getElementById('empty-cart-message');
    let totalCart = 0;

    if (saleCart.length === 0) {
        emptyCartMessage.classList.remove('hidden');
    } else {
        emptyCartMessage.classList.add('hidden');
        saleCart.forEach(item => {
            totalCart += (item.sellPrice * item.quantityInCart);
            const itemDiv = document.createElement('div');
            itemDiv.className = "flex items-center justify-between bg-gray-900 p-3 rounded-md border border-gray-700";
            itemDiv.innerHTML = `
                <div class="flex-grow">
                    <p class="font-medium text-gray-300">${item.name}</p>
                    <p class="text-sm text-gray-400">${item.quantityInCart} x ${formatCurrency(item.sellPrice)}</p>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="window.removeFromCart('${item.id}')" class="p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors">
                        <i data-lucide="minus" style="width: 16px; height: 16px;"></i>
                    </button>
                    <span class="font-semibold text-gray-300">${item.quantityInCart}</span>
                    <button onclick="window.addToCart('${item.id}')" class="p-1 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors">
                        <i data-lucide="plus" style="width: 16px; height: 16px;"></i>
                    </button>
                </div>
            `;
            cartItemsDiv.appendChild(itemDiv);
        });
    }
    document.getElementById('cart-total').textContent = formatCurrency(totalCart);
    lucide.createIcons();
};

window.updatePaymentType = (eventOrType) => { // Tornada global
    let type;
    if (typeof eventOrType === 'string') {
        type = eventOrType;
    } else {
        type = eventOrType.target.value;
    }
    currentPaymentType = type;
    const customerSelectContainer = document.getElementById('customer-select-container');
    const cardTypeContainer = document.getElementById('card-type-container');

    if (type === 'credit') {
        customerSelectContainer.classList.remove('hidden');
        cardTypeContainer.classList.add('hidden');
    } else if (type === 'card') {
        cardTypeContainer.classList.remove('hidden');
        customerSelectContainer.classList.add('hidden');
        selectedCustomerForSale = '';
        document.getElementById('sale-customer-select').value = '';
    } else {
        customerSelectContainer.classList.add('hidden');
        cardTypeContainer.classList.add('hidden');
        selectedCustomerForSale = '';
        document.getElementById('sale-customer-select').value = '';
    }
    window.updateProcessSaleButtonState();
};

window.updateProcessSaleButtonState = () => { // Tornada global
    const processSaleBtn = document.getElementById('process-sale-btn');
    const customerSelect = document.getElementById('sale-customer-select');

    let isButtonEnabled = saleCart.length > 0;

    if (currentPaymentType === 'credit') {
        selectedCustomerForSale = customerSelect.value;
        if (!selectedCustomerForSale) {
            isButtonEnabled = false;
        }
    }

    processSaleBtn.disabled = !isButtonEnabled;
};

window.processSale = async () => { // Tornada global
    document.getElementById('sale-error-message').classList.add('hidden');

    if (saleCart.length === 0) {
        document.getElementById('sale-error-text').textContent = "O carrinho está vazio.";
        document.getElementById('sale-error-message').classList.remove('hidden');
        return;
    }

    if (currentPaymentType === 'credit' && !selectedCustomerForSale) {
        document.getElementById('sale-error-text').textContent = "Por favor, selecione um cliente para vendas a prazo.";
        document.getElementById('sale-error-message').classList.remove('hidden');
        return;
    }

    try {
        // 1. Registrar a transação de venda
        const totalAmount = saleCart.reduce((acc, item) => acc + (item.sellPrice * item.quantityInCart), 0);
        const transactionRef = await addDoc(collection(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/transactions`), {
            type: 'sale',
            date: new Date().toISOString(),
            items: saleCart.map(item => ({
                productId: item.id,
                productName: item.name,
                quantity: item.quantityInCart,
                pricePerUnit: item.sellPrice,
                totalPrice: item.sellPrice * item.quantityInCart,
            })),
            totalAmount: totalAmount,
            paymentType: currentPaymentType,
            cardType: currentPaymentType === 'card' ? document.querySelector('input[name="cardType"]:checked').value : null,
            customerId: currentPaymentType === 'credit' ? selectedCustomerForSale : null,
            status: currentPaymentType === 'credit' ? 'pending' : 'paid',
        });
        console.log("Transação registrada:", transactionRef.id);

        // 2. Atualizar o estoque dos produtos
        const batchUpdates = saleCart.map(async (item) => {
            const productRef = doc(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/products`, item.id);
            const currentProduct = currentProducts.find(p => p.id === item.id);
            if (currentProduct) {
                const newQuantity = currentProduct.quantity - item.quantityInCart;
                if (newQuantity < 0) {
                    throw new Error(`Estoque insuficiente para ${item.name}`); // Validação de último minuto
                }
                await updateDoc(productRef, { quantity: newQuantity });
            }
        });
        await Promise.all(batchUpdates);
        console.log("Estoque atualizado com sucesso!");

        // 3. Se for venda a prazo, atualizar a dívida do cliente
        if (currentPaymentType === 'credit' && selectedCustomerForSale) {
            const customerRef = doc(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/customers`, selectedCustomerForSale);
            const currentCustomer = currentCustomers.find(c => c.id === selectedCustomerForSale);
            if (currentCustomer) {
                const newTotalDue = (currentCustomer.totalDue || 0) + totalAmount;
                await updateDoc(customerRef, { totalDue: newTotalDue });
                console.log(`Dívida do cliente ${currentCustomer.name} atualizada para ${formatCurrency(newTotalDue)}`);
            }
        }

        // Limpar carrinho e resetar seleção
        saleCart = [];
        selectedCustomerForSale = '';
        currentPaymentType = 'cash';
        document.querySelector('input[name="paymentType"][value="cash"]').checked = true;
        document.getElementById('customer-select-container').classList.add('hidden');
        document.getElementById('card-type-container').classList.add('hidden');
        document.getElementById('sale-customer-select').value = '';
        updateCartDisplay();
        window.updateProcessSaleButtonState();
        showModal('Venda Realizada!', 'A venda foi processada com sucesso!', () => {});

    } catch (err) {
        console.error("Erro ao processar venda:", err);
        document.getElementById('sale-error-text').textContent = `Erro ao processar venda: ${err.message || 'Erro desconhecido.'}`;
        document.getElementById('sale-error-message').classList.remove('hidden');
    }
};

// --- Renderização da View de Dashboard ---
const renderDashboardView = async () => {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="bg-gray-900 rounded-lg border border-orange-600/50 shadow-neon p-6 mb-8">
            <h2 class="text-3xl font-chakra font-bold mb-6 text-orange-400 flex items-center">
                <i data-lucide="bar-chart-2" class="mr-3 text-orange-600"></i> Dashboard de Vendas
            </h2>
            
            <div class="mb-6 flex flex-wrap items-end gap-4">
                <div>
                    <label for="start-date" class="block text-sm font-medium text-gray-400">Data Inicial</label>
                    <input type="date" id="start-date" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2">
                </div>
                <div>
                    <label for="end-date" class="block text-sm font-medium text-gray-400">Data Final</label>
                    <input type="date" id="end-date" class="mt-1 block w-full rounded-md bg-gray-700 text-white border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2">
                </div>
                <button id="filter-dashboard-btn" class="px-4 py-2 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 transition-colors flex items-center justify-center shadow-orange">
                    <i data-lucide="filter" class="mr-2"></i> Filtrar
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div class="bg-gray-800 p-6 rounded-lg border border-orange-600/50 flex items-center">
                    <i data-lucide="dollar-sign" class="text-green-500 mr-4" style="width: 32px; height: 32px;"></i>
                    <div>
                        <p class="text-lg text-gray-400">Total de Vendas</p>
                        <p id="total-sales" class="text-3xl font-bold text-green-400">Carregando...</p>
                    </div>
                </div>
                <div class="bg-gray-800 p-6 rounded-lg border border-orange-600/50 flex items-center">
                    <i data-lucide="alert-circle" class="text-red-500 mr-4" style="width: 32px; height: 32px;"></i>
                    <div>
                        <p class="text-lg text-gray-400">Dívida Total de Clientes</p>
                        <p id="total-debt" class="text-3xl font-bold text-red-400">Carregando...</p>
                    </div>
                </div>
            </div>

            <h3 class="text-2xl font-chakra font-semibold mb-4 text-orange-400 flex items-center">
                <i data-lucide="receipt" class="mr-2 text-orange-600" style="width: 20px; height: 20px;"></i> Últimas Transações
            </h3>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-700 rounded-lg overflow-hidden border border-gray-700">
                    <thead class="bg-gray-800">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Tipo
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Descrição
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Valor
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Data
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody id="transactions-table-body" class="bg-gray-900 divide-y divide-gray-700">
                        </tbody>
                </table>
                <p id="no-transactions-message" class="px-6 py-4 text-center text-sm text-gray-500 hidden">Nenhuma transação registrada.</p>
            </div>
        </div>
    `;
    lucide.createIcons();

    const filterBtn = document.getElementById('filter-dashboard-btn');
    filterBtn.addEventListener('click', () => loadDashboardData());

    loadDashboardData();
};

const loadDashboardData = async () => {
    if (!window.db || !window.currentUser.uid) {
        document.getElementById('total-sales').textContent = "Erro";
        document.getElementById('total-debt').textContent = "Erro";
        document.getElementById('transactions-table-body').innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-red-500">Firebase não inicializado ou usuário não autenticado.</td></tr>`;
        return;
    }

    try {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;

        // Carregar Dívida Total de Clientes
        const customersCollectionRef = collection(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/customers`);
        const customersSnapshot = await getDocs(customersCollectionRef);
        let totalDebtAmount = 0;
        customersSnapshot.forEach(doc => {
            totalDebtAmount += doc.data().totalDue || 0;
        });
        document.getElementById('total-debt').textContent = formatCurrency(totalDebtAmount);

        // Carregar Total de Vendas e Últimas Transações com filtro
        const transactionsCollectionRef = collection(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/transactions`);
        let transactionsQuery = query(transactionsCollectionRef);

        if (startDate) {
            transactionsQuery = query(transactionsQuery, where('date', '>=', `${startDate}T00:00:00.000Z`));
        }
        if (endDate) {
            transactionsQuery = query(transactionsQuery, where('date', '<=', `${endDate}T23:59:59.999Z`));
        }

        const transactionsSnapshot = await getDocs(transactionsQuery);
        let transactions = [];
        let totalSalesAmount = 0;
        transactionsSnapshot.forEach(doc => {
            const data = doc.data();
            transactions.push({ id: doc.id, ...data });
            if (data.type === 'sale') {
                totalSalesAmount += data.totalAmount || 0;
            }
        });

        document.getElementById('total-sales').textContent = formatCurrency(totalSalesAmount);

        // Ordenar por data (mais recente primeiro)
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        const tableBody = document.getElementById('transactions-table-body');
        tableBody.innerHTML = '';
        const noTransactionsMessage = document.getElementById('no-transactions-message');

        if (transactions.length === 0) {
            noTransactionsMessage.classList.remove('hidden');
        } else {
            noTransactionsMessage.classList.add('hidden');
            transactions.slice(0, 10).forEach(transaction => { // Exibe as últimas 10 transações
                const row = tableBody.insertRow();
                const transactionDate = new Date(transaction.date).toLocaleDateString('pt-BR', {
                    year: 'numeric', month: 'numeric', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
                let description = '';
                if (transaction.type === 'sale') {
                    const cardTypeInfo = transaction.cardType ? ` (${transaction.cardType})` : '';
                    description = `Venda para ${transaction.customerId ? (currentCustomers.find(c => c.id === transaction.customerId)?.name || 'Cliente Desconhecido') : 'À Vista'}${cardTypeInfo}`;
                } else if (transaction.type === 'payment') {
                    description = `Pagamento de ${transaction.customerName || 'Cliente Desconhecido'}`;
                }

                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-300 capitalize">${transaction.type === 'sale' ? 'Venda' : 'Pagamento'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${description}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${transaction.type === 'sale' ? 'text-orange-400' : 'text-green-400'} font-semibold">${formatCurrency(transaction.totalAmount || transaction.amount || 0)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${transactionDate}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400 capitalize">${transaction.status === 'pending' ? 'Pendente' : 'Pago'}</td>
                `;
            });
        }

    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
        document.getElementById('total-sales').textContent = "Erro";
        document.getElementById('total-debt').textContent = "Erro";
        document.getElementById('transactions-table-body').innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-red-500">Erro ao carregar dados.</td></tr>`;
    }
};

const loadProductsForSale = () => {
    if (!window.db || !window.currentUser.uid) {
        document.getElementById('available-products-list').innerHTML = `<div class="col-span-full text-center text-red-500 py-8">Firebase não inicializado ou usuário não autenticado.</div>`;
        return;
    }

    const productsCollectionRef = collection(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/products`);
    onSnapshot(productsCollectionRef, (snapshot) => {
        const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        currentProducts = productsData; // Atualiza a lista global de produtos
        displayAvailableProducts(productsData);
    }, (err) => {
        console.error("Erro ao carregar produtos para vendas:", err);
        document.getElementById('sale-error-text').textContent = "Erro ao carregar produtos. Tente novamente mais tarde.";
        document.getElementById('sale-error-message').classList.remove('hidden');
    });
};

const displayAvailableProducts = (products) => {
    const list = document.getElementById('available-products-list');
    list.innerHTML = '';
    const noProductsMessage = document.getElementById('no-available-products-message');

    const availableProducts = products.filter(p => p.quantity > 0);

    if (availableProducts.length === 0) {
        noProductsMessage.classList.remove('hidden');
        return;
    } else {
        noProductsMessage.classList.add('hidden');
    }

    availableProducts.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = "bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col justify-between";
        productCard.innerHTML = `
            <div>
                <p class="font-semibold text-lg text-gray-300">${product.name}</p>
                <p class="text-gray-400 text-sm">Estoque: ${product.quantity}</p>
                <p class="font-bold text-orange-400 text-xl">${formatCurrency(product.sellPrice)}</p>
            </div>
            <button onclick="window.addToCart('${product.id}')" class="mt-3 w-full px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors flex items-center justify-center text-sm shadow-orange">
                <i data-lucide="plus" class="mr-2"></i> Adicionar ao Carrinho
            </button>
        `;
        list.appendChild(productCard);
    });
    lucide.createIcons();
};

const loadCustomersForSale = () => {
    if (!window.db || !window.currentUser.uid) {
        document.getElementById('sale-customer-select').innerHTML = `<option value="">Erro ao carregar clientes</option>`;
        return;
    }

    const customersCollectionRef = collection(window.db, `artifacts/${window.appId}/users/${window.currentUser.uid}/customers`);
    onSnapshot(customersCollectionRef, (snapshot) => {
        const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        currentCustomers = customersData; // Atualiza a lista global de clientes
        const select = document.getElementById('sale-customer-select');
        select.innerHTML = '<option value="">Selecione um cliente</option>'; // Limpa e adiciona a opção padrão
        customersData.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.name;
            select.appendChild(option);
        });
        window.updateProcessSaleButtonState();
    }, (err) => {
        console.error("Erro ao carregar clientes para vendas:", err);
        document.getElementById('sale-error-text').textContent = "Erro ao carregar clientes para vendas. Tente novamente mais tarde.";
        document.getElementById('sale-error-message').classList.remove('hidden');
    });
};
