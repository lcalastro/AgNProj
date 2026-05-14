import { apiPost, apiGet, toast } from './utils.js';

export async function initFornecedorCadastro() {
  const content = document.getElementById('content');
  const segmentos = await apiGet('/api/segmentos');

  content.innerHTML = `
    <div class="card card-primary card-outline">
      <div class="card-header">
        <h3 class="card-title"><i class="fas fa-building mr-2"></i>Cadastro de Fornecedor</h3>
      </div>

      <form id="formFornecedor">
        <div class="card-body">

          <div class="row">
            <div class="col-md-4">
              <label>CNPJ *</label>
              <input name="cnpj" class="form-control" required>
            </div>
            <div class="col-md-8">
              <label>Razão Social *</label>
              <input name="razao_social" class="form-control" required>
            </div>
          </div>

          <div class="row mt-2">
            <div class="col-md-2"><label>Contato</label><input name="contato" class="form-control"></div>
            <div class="col-md-4"><label>Cidade</label><input name="cidade" class="form-control"></div>
            <div class="col-md-2"><label>UF</label><input name="uf" class="form-control"></div>
            <div class="col-md-4"><label>E-mail</label><input name="email" type="email" class="form-control"></div>
          </div>

          <div class="mt-2">
            <label>Endereço</label>
            <input name="endereco" class="form-control">
          </div>

          <div class="mt-2">
            <label>Atividades</label>
            <textarea name="atividades" rows="2" class="form-control"></textarea>
          </div>

          <hr>

          <h6 class="text-secondary font-weight-bold">Telefones</h6>
          <div class="row">
            ${[1,2,3].map(i => `
              <div class="col-md-2">
                <input name="telefone_${i}" class="form-control" placeholder="Telefone ${i}">
                <div class="form-check">
                  <input type="checkbox" name="whatsapp_${i}" class="form-check-input">
                  <label class="form-check-label">WhatsApp</label>
                </div>
              </div>
            `).join('')}
          </div>

          <hr>

          <label>Segmentos</label>
          <select name="segmentos" multiple class="form-control">
            ${segmentos.map(s => `<option value="${s.id}">${s.nome}</option>`).join('')}
          </select>

        </div>

        <div class="card-footer text-right">
          <button class="btn btn-primary">
            <i class="fas fa-save"></i> Salvar
          </button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('formFornecedor')
    .addEventListener('submit', salvarFornecedor);
}

async function salvarFornecedor(e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);
  formData.delete('segmentos'); // REMOVE o campo problemático
  const raw = Object.fromEntries(formData);

  // Telefones
  const telefones = [];
  for (let i = 1; i <= 3; i++) {
    if (raw[`telefone_${i}`]) {
      telefones.push({
        numero: raw[`telefone_${i}`].replace(/\D/g, ''),
        whatsapp: !!raw[`whatsapp_${i}`]
      });
    }
  }

  // Segmentos (array de IDs)
  const segmentos = Array.from(
    form.querySelector('[name="segmentos"]').selectedOptions
  ).map(o => Number(o.value));

  // Payload LIMPO (somente o que o backend espera)
  const payload = {
    cnpj: raw.cnpj,
    razao_social: raw.razao_social,
    cidade: raw.cidade,
    uf: raw.uf,
    endereco: raw.endereco,
    email: raw.email,
    atividades: raw.atividades,
    telefones,
    segmentos
  };

  try {
    await apiPost('/api/fornecedores', payload);
    toast('Fornecedor cadastrado com sucesso!');
    form.reset();
  } catch (err) {
    alert(err.message);
  }
}
