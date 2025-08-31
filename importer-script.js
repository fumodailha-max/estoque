import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Suas credenciais do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBszbg1MsMFxK5Si_VuXzdQZTpKfAmiAME",
    authDomain: "fdiestoque.firebaseapp.com",
    projectId: "fdiestoque",
    storageBucket: "fdiestoque.firebasestorage.app",
    messagingSenderId: "125497955543",
    appId: "1:125497955543:web:c820dcb7e2a99ffdcc0c92"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// Verifica a autenticação antes de habilitar a UI
onAuthStateChanged(auth, (user) => {
    const authCheckDiv = document.getElementById('auth-check');
    const importerUiDiv = document.getElementById('importer-ui');

    if (user) {
        currentUser = user;
        authCheckDiv.innerHTML = `<p class="text-green-400">Autenticado como ${user.email}. Pronto para importar.</p>`;
        importerUiDiv.classList.remove('hidden');
    } else {
        authCheckDiv.innerHTML = `<p class="text-red-500">Erro: Você não está logado. <a href="login.html" class="underline">Faça o login aqui</a> e depois volte para esta página.</p>`;
        importerUiDiv.classList.add('hidden');
    }
});

// Lógica de importação
document.getElementById('import-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('html-file');
    const statusDiv = document.getElementById('import-status');

    if (!fileInput.files.length) {
        statusDiv.innerHTML = `<p class="text-red-500">Por favor, selecione um arquivo HTML.</p>`;
        return;
    }
    if (!currentUser) {
        statusDiv.innerHTML = `<p class="text-red-500">Usuário não autenticado. Não é possível importar.</p>`;
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (event) => {
        try {
            statusDiv.innerHTML = `<p class="text-yellow-400">Lendo arquivo e processando produtos...</p>`;
            const htmlContent = event.target.result;
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');

            // --- IMPORTANTE: AJUSTE ESTA PARTE ---
            // Você precisa dizer ao script onde encontrar os produtos no seu HTML.
            // O seletor '.produto-item' é um EXEMPLO. Substitua pelo seletor correto do seu arquivo.
            const productElements = doc.querySelectorAll('.produto-item'); 
            
            if (productElements.length === 0) {
                 statusDiv.innerHTML = `<p class="text-red-500">Nenhum produto encontrado no arquivo. Verifique o seletor no arquivo 'importer-script.js'. O seletor de exemplo é '.produto-item'.</p>`;
                 return;
            }

            const batch = writeBatch(db);
            let importedCount = 0;

            productElements.forEach(el => {
                // EXTRATOR DE DADOS: Ajuste os seletores abaixo para que correspondam à estrutura do seu HTML
                const name = el.querySelector('.nome-produto')?.innerText || 'Nome não encontrado';
                const sellPriceText = el.querySelector('.preco-venda')?.innerText.replace('R$', '').replace(',', '.').trim() || '0';
                
                // Valores padrão que você pode ajustar
                const quantity = 1; // Ou extraia do HTML se disponível
                const costPrice = 0; // Preço de custo padrão
                const barcode = '';  // Código de barras padrão
                
                const productData = {
                    name: name,
                    sellPrice: parseFloat(sellPriceText),
                    quantity: parseInt(quantity),
                    costPrice: parseFloat(costPrice),
                    barcode: barcode
                };
                
                // Adiciona a operação de criação ao "batch" (pacote de operações)
                const productRef = doc(collection(db, `artifacts/default-app-id/users/${currentUser.uid}/products`));
                batch.set(productRef, productData);
                importedCount++;
            });

            // Envia todos os produtos para o Firebase de uma vez
            await batch.commit();

            statusDiv.innerHTML = `<p class="text-green-500">Sucesso! ${importedCount} produtos foram importados.</p>`;

        } catch (error) {
            console.error("Erro ao importar:", error);
            statusDiv.innerHTML = `<p class="text-red-500">Ocorreu um erro durante a importação: ${error.message}</p>`;
        }
    };

    reader.readAsText(file);
});
