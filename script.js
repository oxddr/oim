document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const numAttacksInput = document.getElementById('num-attacks');
    const impetAttacksInput = document.getElementById('impet-attacks');
    const attackerSkillButtons = document.getElementById('attacker-skill-buttons');
    const przerzutPorazekButtons = document.getElementById('przerzut-porazek-buttons');
    const przerzutSukcesowButtons = document.getElementById('przerzut-sukcesow-buttons');
    const przebicieButtons = document.getElementById('przebicie-buttons');
    const weaponButtons = document.getElementById('weapon-buttons');
    const defenderArmorButtons = document.getElementById('defender-armor-buttons');
    const redukcjaAtakowButtons = document.getElementById('redukcja-atakow-buttons');
    const defenderWeaponButtons = document.getElementById('defender-weapon-buttons');
    const terrainImpetNegationCheckbox = document.getElementById('terrain-impet-negation');
    const terrainDefensywnyInput = document.getElementById('terrain-defensywny');
    const averageWoundsResult = document.getElementById('average-wounds-result');
    const avgWoundsApproxNote = document.getElementById('avg-wounds-approx-note');
    const chartDiv = document.getElementById('chart');

    // --- Event Handlers ---
    function getSelectedValue(buttonGroup, isNumeric = true) {
        const selectedButton = buttonGroup.querySelector('.selected');
        if (!selectedButton) return isNumeric ? 0 : 'none';
        const value = selectedButton.dataset.value;
        if (value === 'all') return 'all';
        if (value === 'artyleria') return 'artyleria';
        return isNumeric ? parseInt(value, 10) : value;
    }

    function handleButtonClick(event, buttonGroup) {
        const clicked = event.target.closest('button');
        if (!clicked || !buttonGroup.contains(clicked)) return;
        Array.from(buttonGroup.children).forEach(button => button.classList.remove('selected'));
        clicked.classList.add('selected');
        updateResults();
    }

    const inputs = [numAttacksInput, impetAttacksInput, terrainImpetNegationCheckbox, terrainDefensywnyInput];
    inputs.forEach(el => el.addEventListener('change', updateResults));
    inputs.forEach(el => el.addEventListener('input', updateResults));
    const buttonGroups = [attackerSkillButtons, defenderArmorButtons, przebicieButtons, weaponButtons, defenderWeaponButtons, przerzutPorazekButtons, redukcjaAtakowButtons, przerzutSukcesowButtons];
    buttonGroups.forEach(el => el.addEventListener('click', (e) => handleButtonClick(e, el)));

    // --- Calculation Logic ---
    function getDistribution(n, p) {
        if (n <= 0 || p <= 0) return [{ x: 0, y: 1.0 }];
        if (p >= 1) return [{ x: n, y: 1.0 }];
        
        const distribution = [];
        let pmf = Math.pow(1 - p, n);
        for (let k = 0; k <= n; k++) {
            distribution.push({ x: k, y: pmf });
            if (k < n) pmf = pmf * p / (1 - p) * (n - k) / (k + 1);
        }
        return distribution;
    }

    function updateChart(distribution) {
        chartDiv.innerHTML = '';
        if (!distribution || distribution.length === 0) return;

        const maxProb = Math.max(...distribution.map(p => p.y));
        if (maxProb === 0) return;

        let cumulativeProbLessOrEqual = 0;
        const totalProb = distribution.reduce((sum, point) => sum + point.y, 0);

        distribution.forEach(point => {
            cumulativeProbLessOrEqual += point.y;
            if (point.y < 0.001) return; // Don't render tiny bars

            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.height = `${(point.y / maxProb) * 100}%`;
            
            const cumulativeProbGreaterOrEqual = totalProb - (cumulativeProbLessOrEqual - point.y);
            const tooltipText = `P(${point.x}) = ${(point.y * 100).toFixed(2)}% | P(≥${point.x}) = ${(cumulativeProbGreaterOrEqual * 100).toFixed(2)}%`;
            bar.dataset.tooltip = tooltipText;
            bar.dataset.label = point.x;

            chartDiv.appendChild(bar);
        });
    }

    function calculateAvgWoundsMonteCarlo(numAttacks, probHitInitial, przerzutPorazekValue, przerzutSukcesowValue, probSave, finalPrzebicie, numSimulations = 20000) {
        let totalWoundsSum = 0;

        for (let i = 0; i < numSimulations; i++) {
            let hits = 0;
            let initialHits = 0;
            let initialMisses = 0;
            for (let j = 0; j < numAttacks; j++) {
                if (Math.random() < probHitInitial) initialHits++;
                else initialMisses++;
            }

            let missesToReroll = 0;
            let hitsToReroll = 0;
            if (przerzutPorazekValue !== '0' && przerzutSukcesowValue !== '0') {
                let successRerolls = (przerzutSukcesowValue === 'all') ? numAttacks : parseInt(przerzutSukcesowValue, 10);
                let missRerolls = (przerzutPorazekValue === 'all') ? numAttacks : parseInt(przerzutPorazekValue, 10);
                if (successRerolls > missRerolls) {
                    hitsToReroll = initialHits - missRerolls;
                } else if (missRerolls > successRerolls) {
                    missesToReroll = initialMisses - successRerolls;
                }
            } else if (przerzutPorazekValue !== '0') {
                missesToReroll = (przerzutPorazekValue === 'all') ? initialMisses : Math.min(initialMisses, parseInt(przerzutPorazekValue, 10));
            } else if (przerzutSukcesowValue !== '0') {
                hitsToReroll = (przerzutSukcesowValue === 'all') ? initialHits : Math.min(initialHits, parseInt(przerzutSukcesowValue, 10));
            }
     
            if (missesToReroll > 0) {
                let reRollHitsFromMisses = 0;
                for (let j = 0; j < missesToReroll; j++) {
                    if (Math.random() < probHitInitial) reRollHitsFromMisses++;
                }
                hits = initialHits + reRollHitsFromMisses;
            } else if (hitsToReroll > 0) {
                let reRollMissesFromHits = 0;
                for (let j = 0; j < hitsToReroll; j++) {
                    if (Math.random() >= probHitInitial) reRollMissesFromHits++;
                }
                hits = initialHits - reRollMissesFromHits;
            } else {
                hits = initialHits;
            }

            let successfulSaves = 0;
            for (let j = 0; j < hits; j++) {
                if (Math.random() < probSave) successfulSaves++;
            }

            let reRollSaves = 0;
            let savesToReroll = Math.min(successfulSaves, finalPrzebicie);
            for (let j = 0; j < savesToReroll; j++) {
                if (Math.random() < probSave) reRollSaves++;
            }
            
            const finalSaves = (successfulSaves - savesToReroll) + reRollSaves;
            totalWoundsSum += (hits - finalSaves);
        }
        return totalWoundsSum / numSimulations;
    }

    function updateResults() {
        // 1. Get all inputs
        const baseAttacks = parseInt(numAttacksInput.value, 10) || 0;
        const impetAttacks = parseInt(impetAttacksInput.value, 10) || 0;
        const attackerSkill = getSelectedValue(attackerSkillButtons);
        const przerzutPorazekValue = getSelectedValue(przerzutPorazekButtons, false);
        const przerzutSukcesowValue = getSelectedValue(przerzutSukcesowButtons, false);
        const basePrzebicieSelection = getSelectedValue(przebicieButtons, false);
        const selectedWeapon = getSelectedValue(weaponButtons, false);
        const defenderArmor = getSelectedValue(defenderArmorButtons);
        const redukcjaAtakowValue = getSelectedValue(redukcjaAtakowButtons);
        const defenderWeapon = getSelectedValue(defenderWeaponButtons, false);
        const terrainImpetNegation = terrainImpetNegationCheckbox.checked;
        const terrainDefensywny = parseInt(terrainDefensywnyInput.value, 10) || 0;
        
        // 2. Determine Special Rules & Overrides
        const isArtilleryAttack = basePrzebicieSelection === 'artyleria';
        let weaponExtraAttacks = 0, weaponExtraImpet = 0, weaponPrzebicieOverride = null, weaponPrzebicieIncrease = 0;
        switch (selectedWeapon) {
            case 'pistolet': weaponExtraAttacks = 1; break;
            case 'kopia':
            case 'kopia_husarska': weaponExtraImpet = 1; weaponPrzebicieOverride = 3; break;
            case 'drzewcowa': weaponPrzebicieIncrease = 1; break;
            case 'drzewcowa_piki': weaponExtraAttacks = 2; weaponExtraImpet = 1; break;
        }

        let defenderWeaponNegatesImpet = false, defenderWeaponParowanieBonus = 0;
        if (defenderWeapon === 'drzewcowa') defenderWeaponNegatesImpet = true;
        else if (defenderWeapon === 'drzewcowa_piki') {
            defenderWeaponNegatesImpet = true;
            defenderWeaponParowanieBonus = 1;
        }

        // 3. Calculate Total Attacks
        let totalImpet = impetAttacks + weaponExtraImpet;
        if (terrainImpetNegation || (defenderWeaponNegatesImpet && selectedWeapon !== 'kopia_husarska')) {
            totalImpet = 0;
        }
        const totalReductions = redukcjaAtakowValue + defenderWeaponParowanieBonus + terrainDefensywny;
        let numAttacks = Math.max(1, baseAttacks + weaponExtraAttacks + totalImpet - totalReductions);

        if (isNaN(numAttacks) || attackerSkill === null || defenderArmor === null) {
            averageWoundsResult.textContent = 'Błędne dane';
            chartDiv.innerHTML = '';
            return;
        }

        // 4. Determine Final Przebicie and Save Probability
        const basePrzebicieValue = isArtilleryAttack ? 0 : parseInt(basePrzebicieSelection, 10) || 0;
        const finalPrzebicie = weaponPrzebicieOverride !== null ? weaponPrzebicieOverride : basePrzebicieValue + weaponPrzebicieIncrease;
        const probSave = isArtilleryAttack ? 0 : defenderArmor / 10;

        // 5. Determine Calculation Method
        const useMonteCarlo = (przerzutPorazekValue !== '0' && przerzutPorazekValue !== 0) || (przerzutSukcesowValue !== '0' && przerzutSukcesowValue !== 0) || finalPrzebicie > 0;
        let isApprox = useMonteCarlo;
        if (isArtilleryAttack) {
            // isApprox = true; // Artillery is not an approximation
        }
        let averageWounds;
        const probHitInitial = attackerSkill / 10;

        if (useMonteCarlo) {
            averageWounds = calculateAvgWoundsMonteCarlo(numAttacks, probHitInitial, przerzutPorazekValue, przerzutSukcesowValue, probSave, finalPrzebicie, 20000);
        } else {
            const avgHits = numAttacks * probHitInitial;
            averageWounds = avgHits * (1 - probSave);
        }

        // 6. Calculate distribution for chart
        const effectiveProbWound = numAttacks > 0 ? averageWounds / numAttacks : 0;
        const distribution = getDistribution(numAttacks, effectiveProbWound);

        // 7. Update UI
        averageWoundsResult.textContent = averageWounds.toFixed(2);
        avgWoundsApproxNote.textContent = isApprox && numAttacks > 0 ? '(przybl.)' : '';
        updateChart(distribution);
    }

    // Initial calculation on page load
    updateResults();
});