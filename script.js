let uploadedFiles = {};
let comparisonResult = null;

// File upload handling
function handleFileUpload(input, fileNumber) {
    const file = input.files[0];
    if (file) {
        const container = input.parentElement;
        const uploadContent = container.querySelector('.upload-content');
        const fileInfo = container.querySelector('.file-info');
        
        uploadContent.classList.add('hidden');
        fileInfo.classList.remove('hidden');
        fileInfo.querySelector('p').textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = new ExcelJS.Workbook();
            workbook.xlsx.load(data).then(wb => {
                const worksheet = wb.worksheets[0];
                // Extrair valores da planilha (1-based, linhas e colunas)
                // Convertendo para array 0-based:
                let jsonData = [];
                worksheet.eachRow({ includeEmpty: true }, function(row, rowNumber) {
                    const rowValues = [];
                    row.eachCell({ includeEmpty: true }, function(cell, colNumber) {
                        rowValues.push(cell.value);
                    });
                    jsonData.push(rowValues);
                });

                uploadedFiles[fileNumber] = {
                    name: file.name,
                    data: jsonData,
                    headers: jsonData[0] || []
                };
                
                updateUI();
            });
        };
        reader.readAsArrayBuffer(file);
    }
}

// Drag and drop functionality
document.querySelectorAll('.file-drop-zone').forEach(zone => {
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });
    
    zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
    });
    
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const input = zone.parentElement.querySelector('input[type="file"]');
            input.files = files;
            const fileNumber = parseInt(input.id.replace('file', ''));
            handleFileUpload(input, fileNumber);
        }
    });
});

function updateUI() {
    const hasFile1 = uploadedFiles[1];
    const hasFile2 = uploadedFiles[2];
    const hasFile3 = uploadedFiles[3];
    
    if (hasFile1 && hasFile2) {
        document.getElementById('comparisonSection').style.display = 'block';
        document.getElementById('compareButtonSection').style.display = 'block';
        
        const keyColumnSelect = document.getElementById('keyColumn');
        keyColumnSelect.innerHTML = '<option value="">Comparar linha completa</option>';
        
        if (hasFile1.headers.length > 0) {
            hasFile1.headers.forEach((header, index) => {
                if (header) {
                    keyColumnSelect.innerHTML += `<option value="${index}">${header}</option>`;
                }
            });
        }
        
        if (hasFile3) {
            document.getElementById('thirdOption').style.display = 'block';
        }
    }
}

document.getElementById('compareBtn').addEventListener('click', function() {
    const selectedMode = document.querySelector('input[name="comparisonMode"]:checked');
    if (!selectedMode) {
        alert('Por favor, selecione um modo de comparação.');
        return;
    }
    performComparison(selectedMode.value);
});

function performComparison(mode) {
    document.getElementById('progressSection').style.display = 'block';
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.getElementById('progressText');
    
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 10;
        progressBar.style.width = progress + '%';
        
        if (progress === 30) progressText.textContent = 'Lendo dados das planilhas...';
        else if (progress === 60) progressText.textContent = 'Comparando linhas...';
        else if (progress === 90) progressText.textContent = 'Gerando resultado...';
        
        if (progress >= 100) {
            clearInterval(progressInterval);
            executeComparison(mode);
        }
    }, 200);
}

function executeComparison(mode) {
    const keyColumnIndex = document.getElementById('keyColumn').value;
    let baseData, compareData, baseName, compareName;
    
    switch(mode) {
        case '1vs2':
            baseData = uploadedFiles[1].data;
            compareData = uploadedFiles[2].data;
            baseName = uploadedFiles[1].name;
            compareName = uploadedFiles[2].name;
            break;
        case '2vs1':
            baseData = uploadedFiles[2].data;
            compareData = uploadedFiles[1].data;
            baseName = uploadedFiles[2].name;
            compareName = uploadedFiles[1].name;
            break;
        case '3vs12':
            baseData = uploadedFiles[3].data;
            compareData = [...uploadedFiles[1].data, ...uploadedFiles[2].data];
            baseName = uploadedFiles[3].name;
            compareName = `${uploadedFiles[1].name} + ${uploadedFiles[2].name}`;
            break;
    }
    
    const matches = [];
    const resultData = [];
    
    baseData.forEach((baseRow, index) => {
        if (index === 0) {
            resultData.push(baseRow);
            return;
        }
        
        let isMatch = false;
        
        if (keyColumnIndex === '') {
            isMatch = compareData.some(compareRow => 
                JSON.stringify(compareRow) === JSON.stringify(baseRow)
            );
        } else {
            const baseValue = baseRow[parseInt(keyColumnIndex)];
            isMatch = compareData.some(compareRow => 
                compareRow[parseInt(keyColumnIndex)] === baseValue
            );
        }
        
        if (isMatch) {
            matches.push(index);
        }
        
        resultData.push(baseRow);
    });
    
    comparisonResult = {
        data: resultData,
        matches: matches,
        baseName: baseName,
        compareName: compareName
    };
    
    showResults(matches.length, baseData.length - 1);
}

function showResults(matchCount, totalRows) {
    document.getElementById('progressSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'block';
    
    const resultsContent = document.getElementById('resultsContent');
    resultsContent.innerHTML = `
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 class="text-lg font-semibold text-blue-800 mb-2">📊 Resumo da Comparação</h3>
            <p class="text-blue-700"><strong>Total de linhas analisadas:</strong> ${totalRows}</p>
            <p class="text-blue-700"><strong>Linhas correspondentes encontradas:</strong> ${matchCount}</p>
            <p class="text-blue-700"><strong>Taxa de correspondência:</strong> ${((matchCount/totalRows)*100).toFixed(1)}%</p>
        </div>
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <p class="text-green-700">✅ Comparação concluída! As linhas correspondentes serão destacadas em azul na planilha gerada.</p>
        </div>
    `;
}

document.getElementById('downloadBtn').addEventListener('click', function() {
    if (!comparisonResult) return;
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Comparação');
    
    comparisonResult.data.forEach((row, rowIndex) => {
        const excelRow = worksheet.addRow(row);
        if (rowIndex > 0 && comparisonResult.matches.includes(rowIndex)) {
            excelRow.eachCell(cell => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFADD8E6' } // azul claro
                };
            });
        }
    });
    
    workbook.xlsx.writeBuffer().then(buffer => {
        const blob = new Blob([buffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        a.download = `Comparacao_${timestamp}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    });
});
