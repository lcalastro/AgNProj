import { mostrarLogin } from './login.js';
import { initGerar } from './gerar.js';
import { initConsultar } from './consultar.js';
import { initUsuarios } from './usuarios.js';
import { initPerfil } from './perfil.js';
import { initAdmin } from './admin.js';
import { initFornecedorCadastro } from './fornecedor-cadastro.js';
import { initFornecedorConsulta } from './fornecedor-consulta.js';
import { initFornecedorEditar } from './fornecedor-editar.js';

function getToken() {
  return localStorage.getItem('agn_token');
}
function getUsuario() {
  return JSON.parse(localStorage.getItem('agn_usuario') || '{}');
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) {
    await mostrarLogin();
    return;
  }
  await montarShell(getUsuario());
  await mostrarView('gerar');
});

async function montarShell(usuario) {
  document.getElementById('app').innerHTML = `
    <nav class="main-header navbar navbar-expand navbar-white navbar-light">
      <a href="#" class="navbar-brand ml-3" onclick="mostrarView('gerar')">
        <img src="/img/Logo-AgN-com-Texto.png" style="height:30px;margin-right:8px;">
      </a>

      <ul class="navbar-nav ml-auto">
        <li class="nav-item">
          <a class="nav-link" href="#" onclick="mostrarView('perfil')">
            <i class="far fa-user mr-1"></i> ${usuario.nome}
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link text-danger" href="#" onclick="logout()">
            <i class="fas fa-sign-out-alt"></i>
          </a>
        </li>
      </ul>
    </nav>

    <aside class="main-sidebar sidebar-dark-primary elevation-4">
      <div class="sidebar">
        <nav class="mt-2">
          <ul class="nav nav-pills nav-sidebar flex-column" data-widget="treeview" role="menu" data-accordion="true">

            <!-- NUMERAÇÃO -->
            <li class="nav-item has-treeview menu-open">
              <a class="nav-link active">
                <i class="nav-icon fas fa-hashtag"></i>
                <p>
                  Numeração
                  <i class="right fas fa-angle-left"></i>
                </p>
              </a>
              <ul class="nav nav-treeview">
                <li class="nav-item">
                  <a class="nav-link" onclick="mostrarView('gerar')">
                    <i class="fas fa-plus nav-icon"></i>
                    <p>Gerar</p>
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" onclick="mostrarView('consultar')">
                    <i class="fas fa-search nav-icon"></i>
                    <p>Consultar</p>
                  </a>
                </li>
              </ul>
            </li>

            <!-- FORNECEDORES -->
            <li class="nav-item has-treeview">
              <a href="#" class="nav-link">
                <i class="nav-icon fas fa-building"></i>
                <p>
                  Fornecedores
                  <i class="right fas fa-angle-left"></i>
                </p>
              </a>
            
              <ul class="nav nav-treeview">
                <li class="nav-item">
                  <a href="#" class="nav-link" onclick="mostrarView('fornecedor-cadastro')">
                    <i class="nav-icon fas fa-plus"></i>
                    <p>Cadastrar</p>
                  </a>
                </li>
                <li class="nav-item">
                  <a href="#" class="nav-link" onclick="mostrarView('fornecedor-consulta')">
                    <i class="nav-icon fas fa-search"></i>
                    <p>Consultar</p>
                  </a>
                </li>
              </ul>
            </li>
          
            <!-- ADMIN -->
            ${usuario.role === 'ADMIN' ? `
            <li class="nav-item">
              <a class="nav-link" onclick="mostrarView('usuarios')">
                <i class="nav-icon fas fa-users"></i><p>Usuários</p>
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" onclick="mostrarView('admin')">
                <i class="nav-icon fas fa-database"></i><p>Backup/Restore</p>
              </a>
            </li>` : ''}
          
            <li class="nav-item">
              <a class="nav-link" onclick="mostrarView('logs')">
                <i class="nav-icon fas fa-history"></i><p>Logs</p>
              </a>
            </li>
          
          </ul>

        </nav>
      </div>
    </aside>

    <div class="content-wrapper">
      <section class="content pt-4">
        <div class="container-fluid" id="content"></div>
      </section>
    </div>
  `;
}

window.mostrarView = async (view, params = {}) => {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const link = document.querySelector(`a[onclick="mostrarView('${view}')"]`);
  if (link) link.classList.add('active');

  const content = document.getElementById('content');
  content.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin"></i></div>';

  if (view === 'gerar') await initGerar();
  else if (view === 'consultar') await initConsultar();
  else if (view === 'fornecedor-cadastro') await initFornecedorCadastro();
  else if (view === 'fornecedor-consulta') await initFornecedorConsulta();
  else if (view === 'fornecedor-editar') await initFornecedorEditar(params);
  else if (view === 'usuarios') await initUsuarios();
  else if (view === 'perfil') await initPerfil();
  else if (view === 'admin') await initAdmin();
  else if (view === 'logs') await mostrarLogs();
};

async function mostrarLogs() {
  const token = getToken();
  try {
    const resp = await fetch('/api/logs', { headers: { Authorization: `Bearer ${token}` } });
    const logs = await resp.json();
    document.getElementById('content').innerHTML = `<div class="card"><div class="card-body table-responsive p-0"><table class="table table-hover text-nowrap"><thead><tr><th>Data</th><th>User</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>${logs.map(l=>`<tr><td>${new Date(l.criadoem).toLocaleString()}</td><td>${l.nome}</td><td>${l.acao}</td><td>${l.detalhes}</td></tr>`).join('')}</tbody></table></div></div>`;
  } catch (e) { document.getElementById('content').innerHTML='Erro logs'; }
}

window.logout = () => {
  localStorage.clear();
  mostrarLogin();
}; 
