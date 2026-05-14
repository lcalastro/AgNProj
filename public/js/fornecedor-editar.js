import { apiGet, apiPut, toast } from './utils.js';

export async function initFornecedorEditar(params) {
  const id = params.id;
  const content = document.getElementById('content');

  const fornecedor = await apiGet(`/api/fornecedores/${id}`);
  const segmentos = await apiGet('/api/segmentos');

  content.innerHTML = `
    <div class="card card-warning card-outline">
      <div class="card-header">
        <h3 class="card-title">
          <i class="fas fa-edit mr-2"></i>Editar Fornecedor
        </h3>
      </div>

      <form id="formEditar">
        <div class="card-body">

          <div class="row">
            <div class="col-md-4">
              <label>CNPJ *</label>
              <input name="cnpj" class="form-control" value="${fornecedor.cnpj}" required>
            </div>
            <div class="col-md-8">
              <label>Razão Social *</label>
              <input name="razao_social" class="form-control" value="${fornecedor.razao_social}" required>
            </div>
          </div>

          <div class="row mt-2">
            <div class="col-md-6">
              <label>Contato</label>
              <input name="contato" class="form-control" value="${fornecedor.contato || ''}">
            </div>
          </div>

          <div class="row mt-2">
            <div class="col-md-2"><label>Contato</label><input name="contato" class="form-control" value="${fornecedor.contato || ''}"></div>
            <div class="col-md-4"><label>Cidade</label><input name="cidade" class="form-control" value="${fornecedor.cidade || ''}"></div>
            <div class="col-md-2"><label>UF</label><input name="uf" class="form-control" value="${fornecedor.uf || ''}"></div>
            <div class="col-md-4"><label>E-mail</label><input name="email" type="email" class="form-control" value="${fornecedor.email || ''}"></div>
          </div>

          <div class="mt-2">
            <label>Endereço</label>
            <input name="endereco" class="form-control" value="${fornecedor.endereco || ''}">
          </div>

          <div class="mt-2">
            <label>Atividades</label>
            <textarea name="atividades" rows="2" class="form-control">${fornecedor.atividades || ''}</textarea>
          </div>

          <hr>

          <h6 class="text-secondary font-weight-bold">Telefones</h6>
          <div class="row">
            ${[0,1,2].map(i => {
              const t = fornecedor.telefones[i] || {};
              return `
                <div class="col-md-2">
                  <input name="telefone_${i}" class="form-control" value="${t.numero || ''}">
                  <div class="form-check">
                    <input type="checkbox" name="whatsapp_${i}" class="form-check-input" ${t.whatsapp ? 'checked' : ''}>
                    <label class="form-check-label">WhatsApp</label>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <hr>

          <label>Segmentos</label>
          <select name="segmentos" multiple class="form-control">
            ${segmentos.map(s =>
              `<option value="${s.id}" ${fornecedor.segmentos.includes(s.nome) ? 'selected' : ''}>
                ${s.nome}
              </option>`
            ).join('')}
          </select>

        </div>

        <div class="card-footer d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-danger" id="btnExcluir">
            <i class="fas fa-trash"></i> Excluir
          </button>
          <button class="btn btn-warning ml-2">
            <i class="fas fa-save"></i> Atualizar
          </button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('formEditar').addEventListener('submit', e => salvar(e, id));
  document.getElementById('btnExcluir').addEventListener('click', () => excluir(id, fornecedor));
}

async function salvar(e, id) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  fd.delete('segmentos');

  const raw = Object.fromEntries(fd);

  const telefones = [];
  for (let i = 0; i < 3; i++) {
    if (raw[`telefone_${i}`]) {
      telefones.push({
        numero: raw[`telefone_${i}`].replace(/\D/g, ''),
        whatsapp: !!raw[`whatsapp_${i}`]
      });
    }
  }

  const segmentos = Array.from(
    form.querySelector('[name="segmentos"]').selectedOptions
  ).map(o => Number(o.value));

  await apiPut(`/api/fornecedores/${id}`, {
    ...raw,
    telefones,
    segmentos
  });

  toast('Fornecedor atualizado com sucesso!');
  mostrarView('fornecedor-consulta');
}

async function excluir(id, fornecedor) {
  const ok = confirm(
    `Deseja excluir o fornecedor:\n\n${fornecedor.razao_social}\nCNPJ: ${fornecedor.cnpj}\n\nEssa ação não pode ser desfeita.`
  );
  if (!ok) return;

  await fetch(`/api/fornecedores/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('agn_token')}`
    }
  });

  toast('Fornecedor excluído.');
  mostrarView('fornecedor-consulta');
}
