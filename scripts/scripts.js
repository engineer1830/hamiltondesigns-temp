const hamButton = document.querySelector("#menu");
const navigation = document.querySelector(".navigation");

hamButton.addEventListener("click", () => {
    navigation.classList.toggle("open");
    hamButton.classList.toggle("open");
});

const year = new Date().getFullYear();
document.getElementById("currentyear").textContent = year;

document.getElementById("lastModified").innerHTML = document.lastModified;

const phases = [
    {
        phasesName: "Aggressive Growth",
        description: "Young and living with determined discipline",
        startAge: 20,
        endAge: 49,
        investmentSplit: "100% stocks / 0% bonds",
        timeToRetirement: "20+ years",
        imageUrl: "images/aggressive-small.jpg",
        alt: "Aggressive growth phase illustration"
    },
    {
        phasesName: "Moderate Growth",
        description: "Middle-aged and looking to the future",
        startAge: 50,
        endAge: 59,
        investmentSplit: "65% stocks / 35% bonds",
        timeToRetirement: "10 - 15 years",
        imageUrl: "images/moderate-small.jpg",
        alt: "Moderate growth phase illustration"
    },
    {
        phasesName: "Preserving Wealth",
        description: "Shadow of retirement and finishing the plan",
        startAge: 60,
        endAge: 69,
        investmentSplit: "50% stocks / 50% bonds",
        timeToRetirement: "2 - 5 years",
        imageUrl: "images/retirement-small.jpg",
        alt: "Retirement growth phase illustration"
    },
    {
        phasesName: "Legacy",
        description: "Preparing to leave a blessing to your heirs",
        startAge: 70,
        endAge: 120,
        investmentSplit: "35% stocks / 65% bonds",
        timeToRetirement: "0",
        imageUrl: "images/legacy-small.jpg",
        alt: "Legacy growth phase illustration"
    },
    {
        phasesName: "Withdrawal",
        description: "Retired and unfettered and living the plan",
        startAge: 60,
        endAge: 120,
        investmentSplit: "50% stocks / 50% bonds until Legacy age",
        timeToRetirement: "0",
        imageUrl: "images/withdrawal-small.jpg",
        alt: "Withdrawal phase illustration"
    }
];

function getPhasesForAge(age) {
    return phases
        .filter(p => age <= p.endAge)
        .sort((a, b) => a.startAge - b.startAge);
}

document.getElementById("ageInput").addEventListener("input", e => {
    const age = parseInt(e.target.value, 10);

    localStorage.setItem("phaseAge", age);

    if (!isNaN(age)) {
        const list = getPhasesForAge(age);
        createPhaseCard(list);
    }
});

function createPhaseCard(list) {
    const grid = document.querySelector(".gallery-grid");
    grid.innerHTML = "";

    list.forEach(phase => {
        let card = document.createElement("section");
        let name = document.createElement("h3");
        let desc = document.createElement("h4");
        let split = document.createElement("p");
        let time = document.createElement("p");

        name.textContent = phase.phasesName;
        desc.textContent = phase.description;
        split.innerHTML = `
            <img class="phase-img"
                src="${phase.imageUrl}"
                alt="${phase.alt}"
                width="250"
                height="auto"
                loading="lazy">
            <span class="label"><strong>Investment Split:</strong></span> ${phase.investmentSplit}`;
        time.innerHTML = `<span class="label"><strong>Time to Retirement:</strong></span> ${phase.timeToRetirement}`;

        card.appendChild(name);
        card.appendChild(desc);
        card.appendChild(split);
        card.appendChild(time);
        grid.appendChild(card);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const savedAge = localStorage.getItem("phaseAge");
    if (savedAge) {
        const age = parseInt(savedAge, 10);
        const input = document.getElementById("ageInput");

        input.value = age;

        const list = getPhasesForAge(age);
        createPhaseCard(list);
    }
});

