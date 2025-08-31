import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, writeBatch, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
            // **CORREÇÃO AQUI:** Renomeei a variável 'doc' para 'parsedHtml'
            const parsedHtml = parser.parseFromString(htmlContent, 'text/html');

            const allRows = parsedHtml.querySelectorAll('table tr');
            
            const productElements = Array.from(allRows).slice(1);

            if (productElements.length === 0) {
                 statusDiv.innerHTML = `<p class="text-red-500">Nenhuma linha de produto foi encontrada na tabela do arquivo. Verifique se o arquivo HTML selecionado está correto.</p>`;
                 return;
            }

            const batch = writeBatch(db);
            let importedCount = 0;

            productElements.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 8) return;

                const barcode = cells[0]?.innerText.trim() || '';
                const name = cells[1]?.innerText.trim() || 'Nome não encontrado';
                const sellPriceText = cells[4]?.innerText.replace(',', '.').trim() || '0';
                const costPriceText = cells[6]?.innerText.replace(',', '.').trim() || '0';
                const quantityText = cells[7]?.innerText.trim() || '0';
                
                if (name.toUpperCase().includes('TAXA DE ENTREGA')) {
                    return; 
                }
                
                const productData = {
                    name: name,
                    barcode: barcode,
                    quantity: parseInt(quantityText) || 0,
                    costPrice: parseFloat(costPriceText) || 0,
                    sellPrice: parseFloat(sellPriceText) || 0,
                };
                
                // **CORREÇÃO AQUI:** Agora a função 'doc' do Firebase pode ser usada sem conflito
                const productRef = doc(collection(db, `artifacts/default-app-id/users/${currentUser.uid}/products`));
                batch.set(productRef, productData);
                importedCount++;
            });

            await batch.commit();

            statusDiv.innerHTML = `<p class="text-green-500">Sucesso! ${importedCount} produtos foram importados.</p>`;

        } catch (error) {
            console.error("Erro ao importar:", error);
            statusDiv.innerHTML = `<p class="text-red-500">Ocorreu um erro durante a importação: ${error.message}</p>`;
        }
    };

    reader.readAsText(file);
});
