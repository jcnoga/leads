// Se não houver créditos, gera leads fictícios (máx 10) e avisa
if (currentUserProfile.credits <= 0) {
    const mockLimit = Math.min(limit, 10);
    alert(`⚠️ Você não tem créditos. Gerando ${mockLimit} lead(s) fictício(s) para demonstração.`);
    leads = generateMockLeads(niche, city, state, mockLimit);
    isReal = false;
    // Não consome créditos
} else if (currentUserProfile.credits < limit) {
    alert(`Créditos insuficientes. Você tem ${currentUserProfile.credits} créditos. Serão gerados leads fictícios (até 10) para demonstração.`);
    const mockLimit = Math.min(limit, 10);
    leads = generateMockLeads(niche, city, state, mockLimit);
    isReal = false;
} else {
    // Tenta buscar reais
    try { ... } catch { ... }
}