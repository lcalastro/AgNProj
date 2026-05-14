export async function mostrarLogin() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="login-page" style="min-height: 100vh; display:flex; align-items:center; justify-content:center;">
      <div class="login-box" style="width:400px; max-width:90%;">
        <div class="card card-outline card-primary">
          <div class="card-header text-center">
            <img src="/img/Logo-AgN-com-Texto.png"
                 alt="AgN - Numeração"
                 style="max-width:180px; margin-bottom:8px;">
            <p class="mb-0 text-muted">Sistema de Numeração AgSUS</p>
          </div>

          <div class="card-body">
            <!-- LOGIN -->
            <form id="formLogin">
              <div class="input-group mb-3">
                <input type="email" id="loginEmail" class="form-control" placeholder="E-mail" required>
                <div class="input-group-append">
                  <span class="input-group-text"><i class="fas fa-envelope"></i></span>
                </div>
              </div>

              <div class="input-group mb-3">
                <input type="password" id="loginSenha" class="form-control" placeholder="Senha" required>
                <div class="input-group-append">
                  <span class="input-group-text"><i class="fas fa-lock"></i></span>
                </div>
              </div>

              <button type="submit" class="btn btn-primary btn-block">Entrar</button>
            </form>

            <!-- ESQUECI SENHA -->
            <form id="formEsqueciSenha" class="d-none mt-3">
              <div class="input-group mb-3">
                <input type="email" id="resetEmail" class="form-control"
                       placeholder="Digite seu e-mail" required>
                <div class="input-group-append">
                  <span class="input-group-text"><i class="fas fa-key"></i></span>
                </div>
              </div>
              <button type="submit" class="btn btn-outline-primary btn-block">
                Enviar link de redefinição
              </button>
            </form>

            <div class="text-center mt-3">
              <a href="#" id="linkEsqueci" class="text-sm">
                <i class="fas fa-key mr-1"></i> Esqueci minha senha
              </a>
              <a href="#" id="linkVoltar" class="text-sm d-none">
                <i class="fas fa-arrow-left mr-1"></i> Voltar para login
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  /* LOGIN */
  document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginEmail.value;
    const senha = loginSenha.value;

    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.erro || 'Falha no login');

      localStorage.setItem('agn_token', data.token);
      localStorage.setItem('agn_usuario', JSON.stringify(data.usuario));
      location.reload();
    } catch (err) {
      alert(err.message);
    }
  });

  /* TOGGLE FORM */
  const formLogin = document.getElementById('formLogin');
  const formReset = document.getElementById('formEsqueciSenha');
  const linkEsqueci = document.getElementById('linkEsqueci');
  const linkVoltar = document.getElementById('linkVoltar');

  linkEsqueci.onclick = (e) => {
    e.preventDefault();
    formLogin.classList.add('d-none');
    formReset.classList.remove('d-none');
    linkEsqueci.classList.add('d-none');
    linkVoltar.classList.remove('d-none');
  };

  linkVoltar.onclick = (e) => {
    e.preventDefault();
    formReset.classList.add('d-none');
    formLogin.classList.remove('d-none');
    linkVoltar.classList.add('d-none');
    linkEsqueci.classList.remove('d-none');
  };

  /* ESQUECI SENHA */
  formReset.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value;

    try {
      await fetch('/api/esqueceu-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      alert('Se o e-mail estiver cadastrado, você receberá um link de redefinição.');
      linkVoltar.click();
    } catch {
      alert('Erro ao solicitar redefinição.');
    }
  });
}
