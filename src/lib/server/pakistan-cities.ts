// Pakistani districts/major cities, used to flag shipping addresses whose city
// doesn't match anything deliverable (typos, made-up names, wrong-country entries).
// Static list, not a courier API call — kept intentionally low-maintenance.
export const PAKISTAN_CITIES = [
	'Abbottabad', 'Ahmadpur East', 'Ahmadpur Sial', 'Ahmedpur East', 'Ahmedpur', 'Ali Pur Chatta', 'Aliabad',
	'Alipur', 'Alpuri', 'Arif Wala', 'Arifwala', 'Astore', 'Athara Hazari', 'Attock',
	'Awaran', 'Babuzai', 'Badin', 'Bagh', 'Bahawalnagar', 'Bahawalpur',
	'Bajaur', 'Bala Kot', 'Balakot', 'Baldia', 'Bannu', 'Bar Chamarkand',
	'Bara', 'Barikot', 'Barkhan', 'Batagram', 'Batkhela', 'Bela', 'Benazirabad',
	'Bhag', 'Bhakkar', 'Bhalwal', 'Bhawana', 'Bhera', 'Bhimber', 'Bholari', 'Bhit Shah', 'Bin Qasim',
	'Bori', 'Bostan', 'Buleda', 'Buner', 'Burewala', 'Chachro',
	'Chagai', 'Chak Jhumra', 'Chakesar', 'Chakwal', 'Chaman', 'Chamkani',
	'Charbagh', 'Charsadda', 'Chaubara', 'Chichawatni', 'Chilas', 'Chiniot',
	'Chishtian', 'Chitral', 'Chowk Sarwar Shaheed', 'Chunian', 'Dadu', 'Daggar',
	'Daharki', 'Dajal', 'Dalbandin', 'Daraban', 'Darband', 'Daska',
	'Dassu', 'Datta Khel', 'Depalpur', 'Dera Bugti', 'Dera Ghazi Khan', 'Dera Ismail Khan',
	'Dera Murad Jamali', 'Dhadar', 'Diamer', 'Digri', 'Dipalpur', 'Diplo',
	'Dir', 'Dokri', 'Drosh', 'Duki', 'Dunyapur', 'Dureji',
	'Faisalabad', 'Farooqabad', 'Fateh Jang', 'Ferozepur Road', 'Ferozewala', 'Ferozwala', 'Fort Abbas', 'Gadani',
	'Gadap', 'Gahkuch', 'Gambat', 'Gandakha', 'Gandavah', 'Garhi Khairo',
	'Garhi Yasin', 'Ghanche', 'Ghazi', 'Ghizer', 'Ghorabari', 'Ghotki',
	'Gilgit', 'Gishkaur', 'Gojra', 'Gujar Khan', 'Gujranwala', 'Gujranwala Cantonment',
	'Gujrat', 'Gulberg', 'Gulistan', 'Gulshan-e-Iqbal', 'Gwadar', 'Hafizabad',
	'Hala', 'Hangu', 'Haripur', 'Harnai', 'Haroonabad', 'Hasan Abdal', 'Hasilpur',
	'Hattian Bala', 'Haveli', 'Haveli Lakha', 'Havelian', 'Hoshab', 'Hub',
	'Hunza', 'Hyderabad', 'Ibrahim Hyderi', 'Islamabad', 'Islamkot', 'Jacobabad',
	'Jaffarabad', 'Jahanian', 'Jalalpur Jattan', 'Jampur', 'Jamrud', 'Jamshed',
	'Jaranwala', 'Jati', 'Jatoi', 'Jauharabad', 'Jehangira', 'Jhal Jhao',
	'Jhal Magsi', 'Jhang', 'Jhelum', 'Jhuddo', 'Jiwani', 'Johi',
	'Kabal', 'Kabirwala', 'Kahan', 'Kalat', 'Kamalia', 'Kambar', 'Kamber',
	'Kamber Ali Khan', 'Kamoke', 'Kandhkot', 'Kandiaro', 'Karachi', 'Karak',
	'Karor Lal Esan', 'Kashmore', 'Kasur', 'Katlang', 'Keamari', 'Kech',
	'Khairpur', 'Khairpur Tamewali', 'Khanewal', 'Khanpur', 'Khanpur Katora', 'Khaplu',
	'Khar', 'Kharan', 'Kharian', 'Kharmang', 'Khipro', 'Khost', 'Khyber',
	'Khushab', 'Khuzdar', 'Killa Saifullah', 'Kohat', 'Kohlu', 'Korangi',
	'Kot Abdul Malik', 'Kot Addu', 'Kot Adu', 'Kot Chutta', 'Kot Diji', 'Kot Momin', 'Kot Radha Kishan', 'Kotli',
	'Kotri', 'Kuchlak', 'Kulachi', 'Kunjah', 'Kunri', 'Kurram', 'Lachi',
	'Ladha', 'Lahore', 'Lakki Marwat', 'Lala Musa', 'Lalian', 'Landhi',
	'Landi Kotal', 'Larkana', 'Latifabad', 'Layyah', 'Liaqatpur', 'Liaquatabad', 'Liaquatpur',
	'Liari', 'Lodhran', 'Loralai', 'Ludhewala Waraich', 'Lyari', 'Machh', 'Mailsi',
	'Maiwand', 'Makin', 'Malakwal', 'Malir', 'Mamund', 'Manga Mandi', 'Mand',
	'Mandi Bahauddin', 'Mangocher', 'Manjhand', 'Mansehra', 'Mansoora', 'Mardan', 'Mastuj',
	'Mastung', 'Mathra', 'Matiari', 'Matli', 'Matta', 'Mehar',
	'Mekhtar', 'Mian Channu', 'Mianwali', 'Minchinabad', 'Mingora', 'Mir Ali',
	'Miran Shah', 'Mirpur', 'Mirpur Khas', 'Mirpur Sakro', 'Mithi', 'Model Colony',
	'Model Town', 'Mohmand', 'Moro', 'Multan', 'Muridke', 'Musakhel',
	'Muslim Bagh', 'Muzaffarabad', 'Muzaffargarh', 'Nag', 'Nagar', 'Nagarparkar',
	'Nal', 'Nankana Sahib', 'Narowal', 'Nasirabad', 'Naushahro Feroze', 'Nawabshah',
	'Nawagai', 'Nazimabad', 'Neelum Valley', 'New Karachi', 'Nok Kundi', 'North Nazimabad',
	'North Waziristan', 'Nowshera', 'Nowshera Virkan', 'Nushki', 'Oghi', 'Okara', 'Orakzai', 'Orangi',
	'Ormara', 'Pabbi', 'Paharpur', 'Pak Pattan', 'Pakpattan', 'Panjgur', 'Pano Akil',
	'Paroom', 'Pasni', 'Pasrur', 'Pattoki', 'Peshawar', 'Phalia',
	'Phool Nagar', 'Pind Dadan Khan', 'Pindi Bhattian', 'Pindiali', 'Pirmahal', 'Pishin', 'Pithoro',
	'Poonch', 'Puran', 'Qambar', 'Qasimabad', 'Qilla Abdullah', 'Quetta',
	'Rahim Yar Khan', 'Raiwind', 'Rajanpur', 'Ratodero', 'Rawalakot', 'Rawalpindi',
	'Renala Khurd', 'Rohri', 'Rojhan', 'Rustam', 'Saddar', 'Sadiqabad',
	'Safdarabad', 'Sahiwal', 'Sakran', 'Sakrand', 'Sambrial', 'Samundri',
	'Sanghar', 'Sangla Hill', 'Sarai Alamgir', 'Sargodha', 'Sariab', 'Sarwakai',
	'Sehwan', 'Shabqadar', 'Shah Faisal', 'Shah Kot', 'Shahdadkot', 'Shahdadpur',
	'Shahpur', 'Shahrig', 'Shakargarh', 'Shalimar', 'Shangla', 'Sharak Pur', 'Sheikhupura',
	'Sherani', 'Shigar', 'Shikarpur', 'Shorkot', 'Shujabad', 'Sialkot',
	'Sibi', 'Sillanwali', 'Sinjawi', 'Sinjhoro', 'Skardu', 'Sohbatpur', 'Sonmiani',
	'South Waziristan', 'Sudhanoti', 'Sui', 'Sujawal', 'Sukheki', 'Sukkur', 'Surab', 'Swabi',
	'Swat', 'Taftan', 'Takht Bhai', 'Takht-e-Nasrati', 'Talagang', 'Talhar', 'Tall',
	'Tandlianwala', 'Tando Adam', 'Tando Allahyar', 'Tando Bago', 'Tando Muhammad Khan', 'Tank',
	'Taunsa', 'Taxila', 'Thatta', 'Timergara', 'Toba Tek Singh', 'Toisar',
	'Tonsa', 'Topi', 'Tump', 'Turbat', 'Ubauro', 'Uch Sharif', 'Umerkot',
	'Upper Chitral', 'Upper Dir', 'Usta Muhammad', 'Uthal', 'Vehari', 'Wadh',
	'Wah Cantonment', 'Wah Cantt', 'Wana', 'Warah', 'Wari', 'Washuk', 'Wazirabad',
	'Yakmach', 'Yazman', 'Zafarwal', 'Zamuran', 'Zehri', 'Zhob',
	'Ziarat'
].map((c) => c.trim());

const NORMALIZED = new Set(PAKISTAN_CITIES.map(normalizeCityName));

export function normalizeCityName(city: string): string {
	return city.trim().toLowerCase().replace(/[^a-z]/g, '');
}

export function isKnownPakistanCity(city: string): boolean {
	const normalized = normalizeCityName(city);
	if (!normalized) return false;
	if (NORMALIZED.has(normalized)) return true;
	// Loose containment match — catches "Karachi City", "Lahore Cantt", "New Karachi" etc.
	for (const known of NORMALIZED) {
		if (normalized.includes(known) || known.includes(normalized)) return true;
	}
	return false;
}
