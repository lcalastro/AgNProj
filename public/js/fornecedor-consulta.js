import { apiGet } from './utils.js';

/* =========================================================
   Helpers
   ========================================================= */

function linkWhatsapp(numero) {
  const hora = new Date().getHours();
  const msg = hora < 12 ? 'Bom dia!' : 'Boa tarde!';
  return `https://wa.me/55${numero}?text=${encodeURIComponent(msg)}`;
}

/* =========================================================
   INIT
   ========================================================= */

export async function initFornecedorConsulta() {
  const content = document.getElementById('content');
  const segmentos = await apiGet('/api/segmentos');

  content.innerHTML = `
    <div class="card card-primary card-outline">
      <div class="card-header">
        <h3 class="card-title">
          <i class="fas fa-search mr-2"></i>Consulta de Fornecedores
        </h3>
      </div>

      <div class="card-body">

      <!-- FILTROS -->
      <form id="formBusca" class="mb-3">
        <div class="form-row">
          <div class="col-md-4">
            <input name="razao_social" class="form-control" placeholder="Razão Social">
          </div>
      
          <div class="col-md-3">
            <input name="cidade" class="form-control" placeholder="Município">
          </div>
      
          <div class="form-group col-2 col-sm-2">
            <input name="uf" type="text" class="form-control" maxlength="2" placeholder="UF">
          </div>
      
          <div class="col-md-2">
            <select name="segmento" class="form-control">
              <option value="">Segmento</option>
              ${segmentos.map(s => `<option value="${s.id}">${s.nome}</option>`).join('')}
            </select>
          </div>
      
          <div class="col-md-1">
            <button class="btn btn-primary btn-block">
              <i class="fas fa-search"></i>
            </button>
          </div>
        </div>
      </form>

     <div id="infoPreview" class="alert alert-info py-2 small" style="display:none"></div>

     <!-- TABELA -->
     <div class="table-responsive">
       <table class="table table-hover table-striped">
         <thead>
           <tr>
             <th>Razão Social</th>
             <th>Telefones</th>
             <th>Segmentos</th>
             <th style="width:100px">Ação</th>
           </tr>
         </thead>
         <tbody id="tbody">
           <tr>
             <td colspan="4" class="text-center text-muted p-4">
               Utilize os filtros acima ou visualize os registros cadastrados.
             </td>
           </tr>
         </tbody>
       </table>
     </div>

   </div>
 </div>
`;

  document.getElementById('formBusca')
    .addEventListener('submit', buscarFornecedores);

  buscarFornecedores();
}

/* =========================================================
   BUSCA
   ========================================================= */

async function buscarFornecedores(e) {
  if (e) e.preventDefault();

  const tbody = document.getElementById('tbody');
  tbody.innerHTML = `
    <tr>
      <td colspan="4" class="text-center">
        <i class="fas fa-spinner fa-spin"></i> Buscando...
      </td>
    </tr>
  `;

  try {
    const params = new URLSearchParams(
      new FormData(document.getElementById('formBusca'))
    );

   const resp = await apiGet(`/api/fornecedores?${params}`);
   const lista = resp.dados;
   const total = resp.total;

   const info = document.getElementById('infoPreview');
   
   const temFiltro =
     (params.get('razao_social') || '').trim() ||
     (params.get('cidade') || '').trim() ||
     (params.get('uf') || '').trim() ||
     (params.get('segmento') || '').trim();

   if (!temFiltro) {
     info.innerHTML = `
       Exibindo uma pré-visualização de até
       <strong>15 fornecedores</strong>
       de um total de
       <strong>${total}</strong> cadastrados.
       Utilize os filtros para ver todos os resultados.
     `;
     info.style.display = 'block';
   } else {
     info.style.display = 'none';
   }
   
    if (!lista.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted">
            Nenhum fornecedor encontrado.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = lista.map(f => `
      <tr>
        <td>${f.razao_social}</td>

        <td>
          ${(f.telefones || []).length
            ? f.telefones.map(t =>
                t.whatsapp
                  ? `<a href="${linkWhatsapp(t.numero)}" target="_blank">
                       <i class="fab fa-whatsapp text-success"></i> ${t.numero}
                     </a>`
                  : t.numero
              ).join('<br>')
            : '<span class="text-muted">-</span>'}
        </td>

        <td>
          ${(f.segmentos || []).length
            ? f.segmentos.map(s =>
                `<span class="badge badge-info mr-1">${s}</span>`
              ).join('')
            : '<span class="text-muted">-</span>'}
        </td>

        <td>
          <button class="btn btn-sm btn-info" onclick="verFornecedor(${f.id})">
            <i class="fas fa-eye"></i> Detalhes
          </button>
        </td>
      </tr>
    `).join('');

    // necessário para o onclick funcionar
    window.verFornecedor = verFornecedor;

  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-danger text-center">
          Erro: ${err.message}
        </td>
      </tr>
    `;
  }
}

/* =========================================================
   DETALHES (MODAL)
   ========================================================= */

async function verFornecedor(id) {
  try {
    const f = await apiGet(`/api/fornecedores/${id}`);

    const telefonesHtml = (f.telefones || []).length
      ? f.telefones.map(t =>
          t.whatsapp
            ? `<a href="${linkWhatsapp(t.numero)}" target="_blank">
                 <i class="fab fa-whatsapp text-success"></i> ${t.numero}
               </a>`
            : t.numero
        ).join('<br>')
      : '-';

    const segmentosHtml = (f.segmentos || []).length
      ? f.segmentos.map(s =>
          `<span class="badge badge-info mr-1">${s}</span>`
        ).join('')
      : '-';

    const html = `
      <div class="text-left">

        <!-- Cabeçalho -->
        <div class="callout callout-info mb-4">
          <h5 class="font-weight-bold mb-0">${f.razao_social}</h5>
          <small class="text-muted">CNPJ: ${f.cnpj}</small>
        </div>

        <!-- Dados principais -->
        <h6 class="text-secondary text-uppercase font-weight-bold border-bottom pb-2 mb-3">
          <i class="fas fa-building mr-2"></i>Dados do Fornecedor
        </h6>

        <div class="row mb-3">
          <div class="col-md-6 mb-2">
            <label class="small text-muted mb-0">Cidade / UF</label>
            <div class="font-weight-bold">${f.cidade || '-'} / ${f.uf || '-'}</div>
          </div>

          <div class="col-md-6 mb-2">
            <label class="small text-muted mb-0">E-mail</label>
            <div class="font-weight-bold">${f.email || '-'}</div>
          </div>

          <div class="col-12 mb-2">
            <label class="small text-muted mb-0">Endereço</label>
            <div class="font-weight-bold">${f.endereco || '-'}</div>
          </div>
        </div>

        <!-- Contato -->
        <h6 class="text-secondary text-uppercase font-weight-bold border-bottom pb-2 mb-3 mt-4">
          <label class="small text-muted mb-0">Contato</label>
          <div class="font-weight-bold">${f.contato || '-'}</div>
        </h6>

        <!-- Telefones -->
        <h6 class="text-secondary text-uppercase font-weight-bold border-bottom pb-2 mb-3 mt-4">
          <i class="fas fa-phone mr-2"></i>Telefones
        </h6>

        <div class="mb-3">${telefonesHtml}</div>

        <!-- Segmentos -->
        <h6 class="text-secondary text-uppercase font-weight-bold border-bottom pb-2 mb-3">
          <i class="fas fa-tags mr-2"></i>Segmentos
        </h6>

        <div class="mb-3">${segmentosHtml}</div>

        <!-- Atividades -->
        ${f.atividades ? `
          <h6 class="text-secondary text-uppercase font-weight-bold border-bottom pb-2 mb-3">
            <i class="fas fa-list mr-2"></i>Atividades
          </h6>
          <div class="text-dark">${f.atividades}</div>
        ` : ''}

         <!-- Ações -->
         <div class="d-flex justify-content-end mt-3">
           <button class="btn btn-warning" onclick="editarFornecedor(${f.id})">
             <i class="fas fa-edit"></i> Editar
           </button>
         </div>
         
         <!-- Rodapé -->
         <div class="mt-3 pt-3 border-top d-flex justify-content-between text-muted small">
           <span>ID Interno: ${f.id}</span>
           <span>Cadastrado em: ${new Date(f.criadoem).toLocaleDateString('pt-BR')}</span>
         </div>
        </div>

      </div>
    `;

    window.editarFornecedor = (id) => {
       Swal.close();
       mostrarView('fornecedor-editar', { id });
    };

     
    Swal.fire({
      html,
      width: '700px',
      showCloseButton: true,
      showConfirmButton: false,
      focusConfirm: false
    });

  } catch (e) {
    alert('Erro ao carregar detalhes do fornecedor: ' + e.message);
  }
}
